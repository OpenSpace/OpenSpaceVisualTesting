#!/usr/bin/python3

import asyncio
import datetime
from glob import glob
import json
import os
import pathlib
from pathlib import Path
import psutil
import re
import shlex
import shutil
import signal
from subprocess import Popen, PIPE, STDOUT, check_output, CalledProcessError
import subprocess
import sys
import time
from websocket import create_connection
import websockets


#This script handles the OpenSpace-specific parts of running an .ostest file

websocket_resource_url = f"ws://localhost:4682/websocket"


class OSSession:
    def __init__(self, profileCL, baseOsDir, appPath, logFilename, platform):
        self.basePath = baseOsDir
        self.log = logFilename
        if len(profileCL) == 0:
            self.profile = "default"
        else:
            self.profile = profileCL
        self.OpenSpaceAppPath = appPath
        self.generateRunCommand()
        self.osProcId = 0
        self.osPythonProcId = 0
        self.platform = platform

    def generateRunCommand(self):
        self.runCommand = [os.path.abspath(os.path.join(
            self.basePath, self.OpenSpaceAppPath))]
        self.runCommand.append("--profile")
        self.runCommand.append(f"{self.profile}")
        self.runCommand.append("--bypassLauncher")
        self.runCommand.append("true")

    def logMessage(self, message):
        print(message)
        today = datetime.datetime.today().strftime("%Y-%m-%d %H:%M:%S")
        lFile = open(self.log, "a+")
        lFile.write(today + "  " + message)
        if self.platform == "windows":
            lFile.write("\r")
        lFile.write("\n")
        lFile.close()

    def setSyncDirectory(self, syncPath):
        os.environ["OPENSPACE_SYNC"] = syncPath

    async def connectRetries(self, url: str, message, nRetries: int):
        for t in range(0, nRetries+1):
            try:
                async with websockets.connect(url) as websocket:
                    await self.transmit(websocket, message)
                    await websocket.close()
                    self.logMessage(f"connectRetries finished with {t} retries.")
                    return True
            # This exception happens if a valid OpenSpace connection is established,
            # but times-out because of a long startup period (e.g. long sync)
            except asyncio.exceptions.TimeoutError:
                self.logMessage("Asyncio TimeoutError")
                time.sleep(120)
            # Handle exceptions that occur when no connection to OpenSpace exists
            # (OpenSpace is not running)
            except ConnectionRefusedError:
                self.logMessage("ConnectionRefusedError")
                time.sleep(1)
            except Exception:
                self.logMessage("Unknown exception")
                time.sleep(1)
        return False
  
    async def startSocketConnectionWithRetries(self, message, nRetries: int):
        success = False
        try:
            success = await self.connectRetries(websocket_resource_url, message, nRetries)
        except asyncio.TimeoutError:
            self.logMessage("startSocketConnectionWithRetries timed-out "
                            "from asyncio.wait_for()")
        return success

    def startSocketConnection(self, message):
        try:
            ws = create_connection(websocket_resource_url)
            ws.send(message)
        except Exception:
            self.logMessage("Unable to create socket connection in startSocketConnection")
            #quit(-3)

    async def transmit(self, websocket: websockets.WebSocketClientProtocol, message):
        try:
            await websocket.send(message)
        except Exception as e:
            template = "In transmit exception {0} occurred. Arguments:\n{1!r}"
            message = template.format(type(e).__name__, e.args)
            self.logMessage(message)

    def startOpenSpace(self):
        print("=============================================")
        print(f"{self.runCommand}")
        print("=============================================")
        self.osProcId = subprocess.Popen(self.runCommand)
        self.osPythonProcId = os.getpid()
        self.logMessage(f"Started OpenSpace instance with ID {str(self.osProcId.pid)}")
        time.sleep(1)
        startTryMsg = self.generateJsonForPause()
        return asyncio.run(self.startSocketConnectionWithRetries(startTryMsg, 2))

    def killOpenSpace(self):
        self.logMessage("Kill OpenSpace instance")
        if self.platform == "linux":
            try:
                self.logMessage(f"Kill process ID {str(self.osProcId.pid)}")
                self.osProcId.terminate()
                self.osProcId.kill()
                os.kill(int(self.osProcId.pid), signal.SIGTERM)
                os.kill(int(self.osProcId.pid), signal.SIGKILL)
                os.system(f"kill -9 {self.osProcId.pid}")
            except OSError:
                self.logMessage("OpenSpace instance already shut down")
        elif self.platform == "windows":
            self.osProcId.send_signal(signal.CTRL_BREAK_EVENT)
            self.osProcId.kill()
        time.sleep(4)

    def isOpenSpaceRunning(self):
        # if self.platform == "linux":
        for proc in psutil.process_iter():
            if proc.pid == self.osProcId.pid:
                if self.osProcId.poll() != None:
                    return False
                else:
                    return True
        return False
        # elif self.platform == "windows":
        #     id = os.getpid()
        #     if id == self.osProcId.pid or id == self.osPythonProcId:
        #         return True
        #     else:
        #         msg = f"OpenSpace instance is not running (mismatch of {id} & "\
        #               f"{self.osProcId.pid} pIDs)"
        #     self.logMessage(msg)
        #     return False


    def quitOpenSpace(self):
        quitRetries = 0
        self.logMessage("Quit OpenSpace instance")
        self.executeSocketSend(self.generateJsonForQuit(), "quit message", 0)
        time.sleep(5)
        while self.isOpenSpaceRunning():
            self.killOpenSpace()
            quitRetries += 1
            if quitRetries > 3:
                self.logMessage("Failing to force-quit OpenSpace instance")
                quit(-2)
        self.logMessage("Confirmed that OpenSpace instance successfully quit")

    def disableHudVisibility(self):
        hideHudMsgs = self.generateJsonForHideHud()
        for m in hideHudMsgs:
            self.executeSocketSend(m, f"hideHudVis message ({m})", 0)

    def generateJsonForQuit(self):
        return self.generateJson("openspace.toggleShutdown", [])

    def generateJsonForSetTime(self, timeStr: str):
        return self.generateJson("openspace.time.setTime", [timeStr])

    def generateJsonForScreenshotFolder(self, folder):
        return self.generateJson("openspace.setScreenshotFolder", [folder])

    def generateJsonForScreenshot(self):
        return self.generateJson("openspace.takeScreenshot", [])

    def generateJsonForHideHud(self):
        propsToDisable = ["Dashboard.IsEnabled",
                          "RenderEngine.ShowLog",
                          "RenderEngine.ShowVersion",
                          "RenderEngine.ShowCamera",
                          "Modules.CefWebGui.Visible"]
        jsonsForHideHud = []
        for p in propsToDisable:
            jsonsForHideHud.append(self.generateJson("openspace.setPropertyValueSingle",
                                                     [p, False]))
        return jsonsForHideHud

    def generateJsonForPause(self):
        return self.generateJson("openspace.time.setPause", [False])

    def generateJsonForAction(self, actionName):
        return self.generateJson("openspace.action.triggerAction", [actionName])

    def generateJsonForScript(self, script: str):
        parensLeft = script.find("(")
        parensRight = script.find(")")
        if parensLeft == -1 or parensRight == -1:
            self.logMessage(f"Error in generating json for script '{script}'. "
                            "Unmatched or missing parentheses.")
        func = script[0:parensLeft]
        remainder = script[parensLeft+1:parensRight]
        if func == "openspace.navigation.setNavigationState":
            params = self.generateParamForNavigationState(script)
            return self.generateJson(func, [params])
        else:
            params = remainder.split(",")
            for i in range(0, len(params)):
                params[i] = params[i].lstrip(" '\"[").rstrip(" '\"]")
                if isParamInt(params[i]):
                    # An int, float, or string representation of an int will end up here
                    if isParamFloat(params[i]):
                        params[i] = float(params[i])
                    else:
                        params[i] = int(params[i])
                elif isParamFloat(params[i]):
                    # A string representation of a float will end up here
                    params[i] = float(params[i])
                elif isParamBool(params[i]):
                    if params[i].lower() == "true":
                        params[i] = True
                    else:
                        params[i] = False
            return self.generateJson(func, params)

    def generateParamForNavigationState(self, navString: str):
        anchorIdx = navString.find("Anchor")
        pitchIdx = navString.find("Pitch")
        positionIdx = navString.find("Position")
        upIdx = navString.find("Up")
        yawIdx = navString.find("Yaw")
        referenceFrameIdx = navString.find("ReferenceFrame")
        result = {}
        if anchorIdx != -1:
            result["Anchor"] = extractValueFromNavString(navString, anchorIdx)
        if pitchIdx != -1:
            result["Pitch"] = float(extractValueFromNavString(navString, pitchIdx))
        if positionIdx != -1:
            result["Position"] = extractArrayFromNavString(navString, positionIdx)
        if upIdx != -1:
            result["Up"] = extractArrayFromNavString(navString, upIdx)
        if yawIdx != -1:
            result["Yaw"] = float(extractValueFromNavString(navString, yawIdx))
        if referenceFrameIdx != -1:
            result["ReferenceFrame"] = extractValueFromNavString(navString,
                                                                 referenceFrameIdx)
        return result

    def generateJson(self, func: str, args: []):
        return json.dumps({"topic": 4,
                           "type": "luascript",
                           "payload": {"function": func, "arguments": args}})

    def sendScript(self, script):
        scriptMsg = self.generateJsonForScript(script)
        self.executeSocketSend(scriptMsg, f"sendScript message ({script})", 0)
        time.sleep(1)

    def action(self, actionName):
        actionMsg = self.generateJsonForAction(actionName)
        self.executeSocketSend(actionMsg, f"action message ({actionName})", 0)
        time.sleep(1)
 
    def setTime(self, timeStr):
        setTimeMsg = self.generateJsonForSetTime(timeStr)
        self.executeSocketSend(setTimeMsg, f"setTime message ({timeStr})", 0)
        time.sleep(1)

    def moveScreenShot(self, scenarioGroup, scenarioName):
        folderName = "${BASE}/user/screenshots/imagetestingfolder"
        self.logMessage(f"move screenshot group/name : {scenarioGroup}/{scenarioName}")
        screenshotFolderMsg = self.generateJsonForScreenshotFolder(folderName)
        self.executeSocketSend(screenshotFolderMsg, "screenshot folder message", 0)
        time.sleep(1)
        screenshotMsg = self.generateJsonForScreenshot()
        self.executeSocketSend(screenshotMsg, "screenshot message", 0)
        time.sleep(2)
        solutionDir = os.getcwd()
        tmpPath = os.path.abspath(os.path.join(self.basePath, "user", "screenshots",
                                               "imagetestingfolder",
                                               "OpenSpace_000000.png"))
        if not Path(tmpPath).is_file():
            self.logMessage(f"Screenshot wasn't successful. Expected to find '{tmpPath}'")
            return
        targetFilename = f"{scenarioGroup}{scenarioName}.png"
        moveToPath = os.path.abspath(os.path.join(solutionDir, "ResultImages",
                                                  self.platform, targetFilename))
        if os.path.isfile(moveToPath):
            os.remove(moveToPath)
        shutil.move(tmpPath, moveToPath)
        self.logMessage(f"Moved screenshot: '{targetFilename}' to '{moveToPath}'")

    def executeSocketSend(self, message, description, nRetries):
        self.logMessage(f"Sending message: '{message}' ({description})")
        time.sleep(0.5)
        sendResult = self.startSocketConnection(message)
        time.sleep(1)

    def waitForPlaybackToFinish(self):
        ws = create_connection(websocket_resource_url)
        commandPayload = {"event": "refresh", "properties": ['state']}
        command = {"topic": 1,"type": "sessionRecording","payload": commandPayload}
        message = json.dumps(command)
        retryCount = 15
        while retryCount > 0:
            ws.send(message)
            response = ws.recv()
            data = json.loads(response)
            if data["payload"]["state"] == "idle":
                break
            time.sleep(10)
            retryCount -= 1
        ws.close()


def isParamFloat(test):
    try:
        float(test)
        return True
    except ValueError:
        return False


def isParamInt(test):
    try:
        int(test)
        return True
    except ValueError:
        return False


def isParamBool(test):
    if test.lower() == "true":
        return True
    elif test.lower() == "false":
        return True
    else:
        return False


#Extract single float value from a navigation string as found in value of
#'Anchor', 'Pitch', and 'Yaw' keys
def extractValueFromNavString(navString: str, headerIdx: int):
    idxEquals = navString.find("=", headerIdx)
    idxComma = navString.find(",", headerIdx)
    if idxComma == -1:
        extracted = navString[idxEquals+1:len(navString)]
    else:
        extracted = navString[idxEquals+1:idxComma]
    return extracted.lstrip(" '\"[{(").rstrip(" '\")}];")


#Extract x,y,z float values from a navigation string as found in value of
#'Position' and 'Up' keys
def extractArrayFromNavString(navString: str, headerIdx: int):
    idxStart = navString.find("{", headerIdx)
    idxEnd = navString.find("}", headerIdx)
    extracted = navString[idxStart+1:idxEnd]
    idxComma0 = navString.find(",", idxStart)
    if idxComma0 != -1:
        idxComma1 = navString.find(",", idxComma0+1)
        x = navString[idxStart+1:idxComma0].lstrip().rstrip()
        y = navString[idxComma0+1:idxComma1].lstrip().rstrip()
        z = navString[idxComma1+1:idxEnd].lstrip().rstrip()
        return [float(x), float(y), float(z)]
    else:
        return [0.0, 0.0, 0.0]


if __name__ == "__main__":
    ospace = OSSession("default", "~/Desktop/OpenSpace", "bin/OpenSpace", "testLog.txt")
    ospace.startOpenSpace()
    time.sleep(30)
    ospace.disableHudVisibility()


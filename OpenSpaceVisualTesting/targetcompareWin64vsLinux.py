#!/usr/bin/python3

import sys
import os
import json
import pathlib
import time
import datetime
from glob import glob
from subprocess import Popen, PIPE, STDOUT, check_output, CalledProcessError

comparisonReportFilename = "comparisonWin64vsLinux.report"

def writeToReport(filename, s):
    try:
        r = open(filename, 'a')
        r.write(s)
    except Exception as e:
        print("Problem writing to " + filename)
    finally:
        r.close()

def compareImage(target, current, diff):
    imgMgck = "compare -fuzz 4%% -metric rmse " + target + " " + current + " " + diff
    p = Popen(imgMgck, shell=True, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True)
    return p.stdout.read()

def appendJsonEntry(compList, testName, isNewTest, compareScore, dtStr):
    compList.append({"name":testName, "new":isNewTest, "score":compareScore, "datet":dtStr})
    return compList

def writeToVisualTestResultsJsonFile(items):
    with open("visualtests_Win64vsLinux_results.json", 'w') as outfile:
        json.dump({"items":items}, outfile)

def processImageFilesAndProduceReports(resultDir, targetDir, diffDir, testSubset):
    winDir = targetDir + "/win64/"
    linuxDir = resultDir + "/linux/"
    diffDir = diffDir + "/linux/"
    imageListingWinTargets = list(glob("**/" + winDir + "/Target*.png", \
        recursive=True))
    items = []
    for resultPath in imageListingWinTargets:
        fileNameBase = pathlib.Path(os.path.basename(resultPath)).stem
        fileNameBase = fileNameBase.replace("Target", "")
        print(fileNameBase[0:len(testSubset)])
        if testSubset != "" and fileNameBase[0:len(testSubset)] != testSubset.replace("/", ""):
            continue
        fileNameWin = winDir + "Target" + fileNameBase + ".png"
        fileNameLinux = linuxDir + fileNameBase + ".png"
        fileNameDiff = diffDir + fileNameBase + ".png"
        compareValue = b""
        found_target = pathlib.Path(fileNameWin).exists()
        found_result = pathlib.Path(fileNameLinux).exists()
        if found_target and found_result:
            print("Comparing '" + fileNameLinux + "' against win64 target '" + fileNameWin + "'.")
            compareValue = compareImage(fileNameWin, fileNameLinux, fileNameDiff)
            compareValue = str(compareValue.decode()).split(" ")[0]
            writeToReport(comparisonReportFilename, fileNameBase + "\n" \
                + compareValue + ";\n")
            dt = os.path.getmtime(fileNameLinux)
            year,month,day,hour,minute,second = time.gmtime(dt)[:-3]
            dtStr = str(year) + "-" + str(month) + "-" + str(day) + " " + \
                str(hour) + ":" + str(minute) + ":" + str(second) + " UTC"
            items = appendJsonEntry(items, fileNameBase, False, str(compareValue), dtStr)
        else:
            if not found_result:
                print("Could not find result file '" + fileNameLinux + "'.")
            if not found_target:
                print("Could not find target file '" + fileNameWin + "'.")
        print("")
    if testSubset == "":
        #Only write json results if all tests were run
        writeToVisualTestResultsJsonFile(items)

if __name__ == "__main__":
    if pathlib.Path(comparisonReportFilename).exists():
        os.remove(comparisonReportFilename)
    testSubsetString = ""
    if len(sys.argv) > 1:
        testSubsetString = sys.argv[1]
    processImageFilesAndProduceReports(\
        "./ResultImages", \
        "./TargetImages", \
        "./DifferenceImages", \
        testSubsetString
    )

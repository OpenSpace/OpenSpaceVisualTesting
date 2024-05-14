##########################################################################################
#                                                                                        #
# OpenSpace Visual Testing                                                               #
#                                                                                        #
# Copyright (c) 2024                                                                     #
#                                                                                        #
# Permission is hereby granted, free of charge, to any person obtaining a copy of this   #
# software and associated documentation files (the "Software"), to deal in the Software  #
# without restriction, including without limitation the rights to use, copy, modify,     #
# merge, publish, distribute, sublicense, and/or sell copies of the Software, and to     #
# permit persons to whom the Software is furnished to do so, subject to the following    #
# conditions:                                                                            #
#                                                                                        #
# The above copyright notice and this permission notice shall be included in all copies  #
# or substantial portions of the Software.                                               #
#                                                                                        #
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,    #
# INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A          #
# PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT     #
# HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF   #
# CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE   #
# OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                                          #
##########################################################################################

import argparse
import datetime
import glob
import json
import os
import requests
import time
from testsuite.constants import test_base_dir
from testsuite.openspace import write_configuration_overwrite, run_single_test
from testsuite.test import TestResult



# TODO: Retry openspace api connection until it works
# TODO: 'screenshot' command has optional argument to determine sub-test name
# TODO: Instead of waiting a fixed amount of time when starting OpenSpace, we can listen
#       to the finished loading event instead

def submit_image(result: TestResult, hardware: str, timestamp: str, file: str,
                 runner: str, url: str):
  """
  Submits a new candidate image to the provided URL. This function logs a method
  indicating whether the image submission succeeded
  """
  res = requests.post(
    url,
    data = {
      "group": result.group,
      "name": result.name,
      "hardware": hardware,
      "runnerID": runner,
      "timestamp": timestamp,
      "timing": result.timing,
      "commitHash": hash
    },
    files = {
      "file": open(file, "rb"),
      "log": result.error
    }
  )
  if res.status_code != 200:
    print(f"Image submission failed with error {res.status_code}")
    print(res.text)
  else:
    print("Image submitted successfully")



def setup_argparse():
  """
  Creates and sets up a parser for commandline arguments. This function returns the parsed
  arguments as a dictionary.
  """
  parser = argparse.ArgumentParser()
  parser.add_argument(
    "-d", "--dir",
    dest="dir",
    type=str,
    help="Specifies the OpenSpace directory in which to run the tests.",
    required=True
  )
  parser.add_argument(
    "-t", "--test",
    dest="test",
    type=str,
    help="A comma-separated list of specific tests that should be run. If this value is "
      "omitted, all tests will be run. Each of the comma-separated entries should be "
      "a path relative to the base visual testing folder without a file extension. For " "example, if there is a test file called `default/earth.ostest`, then the value "
      "provided to this argument should be `default/earth`.",
    required=False
  )
  parser.add_argument(
    "-o", "--overwrite",
    dest="overwrite_path",
    type=str,
    help="This specifies the base path to the folder where data is stored that is reused "
      "between diffrent test runs. The overwrite file will contain settings that we want "
      "all regularly executing test machines to have, such as using caching, reusing "
      "synchronization folders, etc.",
    required=False
  )

  args = parser.parse_args()
  return args



global_start = time.perf_counter()
if not os.path.exists("config.json"):
  raise Exception(f"Could not find config file 'config.json'")

with open("config.json") as f:
  config = json.load(f)

args = setup_argparse()

# Find the executable location and its name
if os.name == "nt":
  # Windows
  executable = f"{args.dir}/bin/RelWithDebInfo/OpenSpace.exe"
else:
  # Linux/Mac
  executable = f"{args.dir}/bin/OpenSpace"

if not os.path.exists(executable):
  raise Exception(f"Could not find executable '{executable}'")


if args.overwrite_path != None:
  write_configuration_overwrite(args.dir, args.overwrite_path)

url = config["url"]
submit_url = f"{url}/api/submit-test"
hardware = config["hardware"]
runner_id = config["id"]

# Running the tests
if args.test is None:
  print("Running all tests in OpenSpace folder")
  files = glob.glob(f"{args.dir}/{test_base_dir}/**/*.ostest", recursive=True)
  for file in files:
    # Normalize the path endings to always do forward slashes
    file = file.replace(os.sep, "/")
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result = run_single_test(file, executable)
    for candidate in result.files:
      submit_image(result, hardware, timestamp, candidate, runner_id, submit_url)
    time.sleep(0.5)
else:
  tests = args.test.split(",")
  print(f"Running tests: {tests}")
  for test in tests:
    path = f"{args.dir}/{test_base_dir}/{test}.ostest"
    if not os.path.isfile(path):
      raise Exception(f"Could not find test '{path}'")

    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result = run_single_test(path, executable)
    for candidate in result.files:
      submit_image(result, hardware, timestamp, candidate, runner_id, submit_url)

global_end = time.perf_counter()
print(f"Total time for all tests: {global_end - global_start}")

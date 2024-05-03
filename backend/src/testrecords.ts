import { printAudit } from "./audit";
import { Config } from "./configuration";
import { OperatingSystem } from "./globals";
import { generateComparison } from "./imagecomparison";
import fs from "fs";


type TestRecord = {
  /// The group name of the test record. This value contains URL safe characters
  group: string; // @TODO Can only be filepath-valid names
  /// The name of the test record. This value contains URL safe characters
  name: string; // @TODO Can only be filepath-valid names
  /// The individual test runs, grouped by the operating system
  data: {
    [K in OperatingSystem]?: [ TestData ]
  }
};

export type TestData = {
  /// Contains the pixel error in the image as a value between 0 and 1 as the ratio of
  /// changed pixels to overall pixels
  pixelError: number;

  /// The timestamp at which this test data was generated
  timeStamp: Date;

  /// The commit hash of the OpenSpace repository that was used to generate this image
  commitHash: string;

  /// Path to the reference image that was used for this test
  referenceImage: string;
}

/// An in-memory data storage of test records. The array gets created at startup time by
/// parsing the 'data' folder and continuously updated as new test data comes in. This
/// array is not stored on disk, but instead recreated from files that are kept instead
export let TestRecords: TestRecord[] = [];

/**
 * Saves a specific test data to the provided path. It will overwrite the file that is
 * already present in that location
 *
 * @param data The TestData object that should be serialized
 * @param path The path to which the data is serialized
 */
export function saveTestData(data: TestData, path: string) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * Add a new test data to the internal list of records that are being kept. If the
 * @param group, @param name, or @param os did not exist before in the record, they will
 * be created inside this function. At the end of the function call, a record will exist
 * that contains at least the @param data passed into this function.
 *
 * @param group The name of the group to which the @param data belongs
 * @param name The name of the test to which the @param data belongs
 * @param os The operating system on which the test was run
 * @param data The test data that should be added to the list of test records
 */
export function addTestData(group: string, name: string, os: OperatingSystem,
                              data: TestData)
{
  printAudit(`Adding new record for (${group}/${name}/${os})`);

  for (let record of TestRecords) {
    if (record.group != group || record.name != name)  continue;

    if (os in record.data) {
      printAudit("  Adding to data existing record");
      // @TODO: Not sure why the '?' is necessary here. We are checking in the 'if'
      //        statement before that `os` exists in `record.data`
      record.data[os]?.push(data);
      record.data[os]?.sort((a, b) => a.timeStamp.getTime() - b.timeStamp.getTime())
    }
    else {
      printAudit("  Creating new record list");
      record.data[os] = [ data ];
    }
    return;
  }

  // if we get here, it's a new record
  printAudit("Creating new test record");
  TestRecords.push({
    group: group,
    name: name,
    data: {
      [os]: [ data ]
    }
  });
}

/**
 * Loads all of the existing test results from the data folder as provided in the
 * configuration. It will iterate through all of the tests and will assert if one of the
 * test folders is malformed due to, for example, missing files.
 */
export function loadTestResults() {
  printAudit("Loading test results");

  let oss = fs.readdirSync(`${Config.data}/tests`);
  for (let os of oss) {
    const base = `${Config.data}/tests/${os}`;

    let groups = fs.readdirSync(base);
    for (let group of groups) {
      let names = fs.readdirSync(`${base}/${group}`);
      for (let name of names) {
        let runs = fs.readdirSync(`${base}/${group}/${name}`);
        for (let run of runs) {
          const p = `${base}/${group}/${name}/${run}`;
          const files = fs.readdirSync(p);
          console.assert(files.length == 3, `Wrong number of files in ${p}`);
          console.assert(files.includes("candidate.png"), `'candidate.png' in ${p}`);
          console.assert(files.includes("difference.png"), `'difference.png' in ${p}`);
          console.assert(files.includes("data.json"), `'data.json' in ${p}`);

          let data: TestData = JSON.parse(fs.readFileSync(`${p}/data.json`).toString());
          data.timeStamp = new Date(data.timeStamp);
          addTestData(group, name, os as OperatingSystem, data);
        }
      }
    }
  }
}

/**
 * This function will regenerate all of the difference images that are locally stored and
 * update the pixel error values in all tests. In general this should only be necessary if
 * the version of the image diff tool has been updated or if the global image threshold
 * limit has changed.
 */
export function regenerateTestResults() {
  printAudit("Regenerating all test results");

  let oss = fs.readdirSync(`${Config.data}/tests`);
  for (let os of oss) {
    const base = `${Config.data}/tests/${os}`;

    let groups = fs.readdirSync(base);
    for (let group of groups) {
      let names = fs.readdirSync(`${base}/${group}`);
      for (let name of names) {
        let runs = fs.readdirSync(`${base}/${group}/${name}`);
        for (let run of runs) {
          const p = `${base}/${group}/${name}/${run}`;

          let data: TestData = JSON.parse(fs.readFileSync(`${p}/data.json`).toString());
          let diff = generateComparison(
            data.referenceImage, `${p}/candidate.png`, `${p}/difference.png`
          );
          data.pixelError = diff;
          saveTestData(data, `${p}/data.json`);
        }
      }
    }
  }

  // Reset the local records and load a fresh version from disk
  TestRecords = [];
  loadTestResults();
}

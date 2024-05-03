function maxPixelDifference(record) {
  let difference = 0;
  for (let [_, value] of Object.entries(record.data)) {
    // res is an array and for the sorting we are only caring about the latest result
    difference = Math.max(difference, value[value.length - 1].pixelDifference);
  }
  return difference;
}

function diffDisplay(diff) {
  return `${Math.round(diff * 100000) / 1000}%`;
}

function classForDiff(diff) {
  // Diff in [0, 1]
  if (diff == 0.0) {
    return "error-0";
  }
  else if (diff < 0.001) {
    return "error-1";
  }
  else if (diff < 0.01) {
    return "error-2";
  }
  else if (diff < 0.05) {
    return "error-3";
  }
  else if (diff < 0.1) {
    return "error-4";
  }
  else if (diff < 0.25) {
    return "error-5";
  }
  else if (diff < 0.5) {
    return "error-6";
  }
  else if (diff < 0.75) {
    return "error-7";
  }
  else if (diff < 1.0) {
    return "error-8";
  }
  else {
    return "error-9";
  }
}

function createHeader(ul) {
  let li = document.createElement("li");
  ul.appendChild(li);

  let div = document.createElement("div");
  li.appendChild(div);

  let status = document.createElement("div");
  status.className = "cell status heading";
  div.appendChild(status);

  let group = document.createElement("div");
  group.className = "cell group heading";
  group.appendChild(document.createTextNode("Group"));
  div.appendChild(group);

  let name = document.createElement("div");
  name.className = "cell name heading";
  name.appendChild(document.createTextNode("Name"));
  div.appendChild(name);

  let os = document.createElement("div");
  os.className = "cell os heading";
  os.appendChild(document.createTextNode("Operating System"));
  div.appendChild(os);

  let diff = document.createElement("div");
  diff.className = "cell diff heading";
  diff.appendChild(document.createTextNode("Error (%)"));
  div.appendChild(diff);

  let commit = document.createElement("div");
  commit.className = "cell commit heading";
  commit.appendChild(document.createTextNode("Commit Hash"));
  div.appendChild(commit);

  let timestamp = document.createElement("div");
  timestamp.className = "cell timestamp heading";
  timestamp.appendChild(document.createTextNode("Timestamp"));
  div.appendChild(timestamp);
}

function createRows(record, ul) {
  for (let [operatingSystem, testData] of Object.entries(record.data)) {
    let li = document.createElement("li");
    li.className = "row";
    ul.appendChild(li);

    let divHead = document.createElement("div");
    let divBody = document.createElement("div");
    {
      divHead.className = "li_head toggle";
      divHead.onclick = () => divBody.classList.toggle("hidden");
      li.appendChild(divHead);

      let status = document.createElement("div");
      let errorClass = classForDiff(testData[testData.length - 1].pixelDifference);
      status.className = `cell status ${errorClass}`;
      divHead.appendChild(status);

      let group = document.createElement("div");
      group.className = "cell group";
      group.appendChild(document.createTextNode(record.group));
      divHead.appendChild(group);

      let name = document.createElement("div");
      name.className = "cell name";
      name.appendChild(document.createTextNode(record.name));
      divHead.appendChild(name);

      let os = document.createElement("div");
      os.className = "cell os";
      os.appendChild(document.createTextNode(operatingSystem));
      divHead.appendChild(os);

      let diff = document.createElement("div");
      diff.className = "cell diff";
      diff.appendChild(document.createTextNode(diffDisplay(testData[testData.length - 1].pixelDifference)));
      divHead.appendChild(diff);

      let commit = document.createElement("div");
      commit.className = "cell commit";
      commit.appendChild(document.createTextNode(testData[testData.length - 1].commitHash));
      divHead.appendChild(commit);

      let timestamp = document.createElement("div");
      timestamp.className = "cell timestamp";
      timestamp.appendChild(document.createTextNode(testData[testData.length - 1].timeStamp));
      divHead.appendChild(timestamp);
    }
    {
      divBody.className = "li_body hidden";
      li.appendChild(divBody);

      let table = document.createElement("table");
      table.className = "history";
      divBody.appendChild(table);


      testData = testData.reverse();
      let trStatus = document.createElement("tr");
      for (let data of testData) {
        let td = document.createElement("td");
        let errorClass = classForDiff(data.pixelDifference);
        td.className = `status ${errorClass}`;
        trStatus.appendChild(td);
      }
      table.appendChild(trStatus);

      let trCandidate = document.createElement("tr");
      for (let data of testData) {
        let td = document.createElement("td");
        td.className = "candidate";
        trCandidate.appendChild(td);

        let a = document.createElement("a");
        a.href = `/api/image/candidate/${record.group}/${record.name}/${operatingSystem}/${data.timeStamp}`;
        a.target = "_blank";
        td.appendChild(a);

        let img = document.createElement("img");
        img.src = a.href;
        a.appendChild(img);
      }
      table.appendChild(trCandidate);

      let trReference = document.createElement("tr");
      for (let data of testData) {
        let td = document.createElement("td");
        td.className = "reference";
        trReference.appendChild(td);

        let a = document.createElement("a");
        a.href = `/api/image/reference/${record.group}/${record.name}/${operatingSystem}/${data.timeStamp}`;
        a.target = "_blank";
        td.appendChild(a);

        let img = document.createElement("img");
        img.src = a.href;
        a.appendChild(img);
      }
      table.appendChild(trReference);

      let trDifference = document.createElement("tr");
      for (let data of testData) {
        let td = document.createElement("td");
        td.className = "difference";
        trDifference.appendChild(td);

        let a = document.createElement("a");
        a.href = `/api/image/difference/${record.group}/${record.name}/${operatingSystem}/${data.timeStamp}`;
        a.target = "_blank";
        td.appendChild(a);

        let img = document.createElement("img");
        img.src = a.href;
        a.appendChild(img);
      }
      table.appendChild(trDifference);

      let trTimeStamp = document.createElement("tr");
      for (let data of testData) {
        let td = document.createElement("td");
        td.className = "timestamp";
        td.appendChild(document.createTextNode(data.timeStamp));
        trTimeStamp.appendChild(td);
      }
      table.appendChild(trTimeStamp);

      let trDiff = document.createElement("tr");
      for (let data of testData) {
        let td = document.createElement("td");
        td.className = "diff";
        td.appendChild(document.createTextNode(diffDisplay(data.pixelDifference)));
        trDiff.appendChild(td);
      }
      table.appendChild(trDiff);

      let trCommit = document.createElement("tr");
      for (let data of testData) {
        let td = document.createElement("td");
        td.className = "commit";
        td.appendChild(document.createTextNode(data.commitHash));
        trCommit.appendChild(td);
      }
      table.appendChild(trCommit);
    }
  }
}

async function main() {
  let records = await fetch("/api/test-records").then(res => res.json());

  // Sort so that the test results with the highest pixel difference are first
  records.sort((a, b) => maxPixelDifference(a) < maxPixelDifference(b));

  let list = document.getElementById("list");

  createHeader(list);

  for (let record of records) {
    let row = createRows(record, list);
  }

}

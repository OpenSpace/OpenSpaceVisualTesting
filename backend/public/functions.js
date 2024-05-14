function diffDisplay(diff) {
  // Round the error to 3 digits past the decimal
  return `${Math.round(diff * 100000) / 1000}%`;
} // function diffDisplay(diff)

function timingDisplay(timing) {
  // Round the riming to 3 digits past the decimal
  return `${Math.round(timing * 1000) / 1000}s`;
} // function timingDisplay(timing)

function classForDiff(diff) {
  // Diff is in [0, 1] and represents % of changed pixels
  if (diff == 0.0)       { return "error-0"; }
  else if (diff < 0.001) { return "error-1"; }
  else if (diff < 0.01)  { return "error-2"; }
  else if (diff < 0.05)  { return "error-3"; }
  else if (diff < 0.1)   { return "error-4"; }
  else if (diff < 0.25)  { return "error-5"; }
  else if (diff < 0.5)   { return "error-6"; }
  else if (diff < 0.75)  { return "error-7"; }
  else if (diff < 1.0)   { return "error-8"; }
  else                   { return "error-9"; }
} // function classForDiff(diff)

function sortRows(column) {
  let list = document.getElementById("list");

  let lis = []
  // Starting a 1 as the first line (the header) should not participate in sorting
  for (let i = 1; i < list.childNodes.length; i++) {
    console.assert(list.childNodes[i].nodeName === "LI");
    lis.push(list.childNodes[i]);
  }

  // Sorts the two `li`s by the column that is captures in this lambda. There is probably
  // a better way to write this, but it works for now and I don't foresee adding many
  // columns to the list for now that we'd want to sort on
  function sortFunc(a, b) {
    console.assert(a.record);
    console.assert(b.record);
    if (column in a.record) {
      console.assert(["group", "name", "hardware"].includes(column));
      console.assert(column in b.record);

      // These are just names so we want to sort them with the lower value first
      return a.record[column] > b.record[column];
    }
    else {
      console.assert(["pixelError", "timing", "commitHash", "timeStamp"].includes(column));
      console.assert(a.record.data.length > 0);
      console.assert(b.record.data.length > 0);

      // These are values that exist in the individual records and we want to sort based
      // on the most recent value, which is at the front of the list
      let aData = a.record.data[0];
      let bData = b.record.data[0];
      console.assert(column in aData);
      console.assert(column in bData);

      let aVal = aData[column];
      let bVal = bData[column];

      if (column == "timeStamp") {
        // The time stamp gets passed to us as an ISO string, which we need to convert
        // into a Date object to do a proper comparison
        return new Date(aVal) > new Date(bVal);
      }
      else if (column == "pixelError") {
        // The pixel error is the only value that we want to sort inverted, meaning that
        // we want the row with the biggest error at the top
        return aVal < bVal;
      }
      else {
        return aVal > bVal;
      }
    }
  }

  lis.sort(sortFunc);
  let newList = list.cloneNode(false);
  // Add the header at the top again
  newList.appendChild(list.childNodes[0]);
  for (let li of lis) {
    newList.appendChild(li);
  }
  list.parentNode.replaceChild(newList, list);
}

function createHeader(ul) {
  let li = document.createElement("li");
  ul.appendChild(li);

  let div = document.createElement("div");
  li.appendChild(div);

  let status = document.createElement("div");
  status.className = "cell status heading";
  status.onclick = () => sortRows("pixelError");
  status.appendChild(document.createTextNode("Error"));
  div.appendChild(status);

  let group = document.createElement("div");
  group.className = "cell group heading";
  group.onclick = () => sortRows("group");
  group.appendChild(document.createTextNode("Group"));
  div.appendChild(group);

  let name = document.createElement("div");
  name.className = "cell name heading";
  name.onclick = () => sortRows("name");
  name.appendChild(document.createTextNode("Name"));
  div.appendChild(name);

  let hw = document.createElement("div");
  hw.className = "cell hardware heading";
  hw.onclick = () => sortRows("hardware");
  hw.appendChild(document.createTextNode("Hardware"));
  div.appendChild(hw);

  let timing = document.createElement("div");
  timing.className = "cell timing heading";
  timing.onclick = () => sortRows("timing");
  timing.appendChild(document.createTextNode("Timing"));
  div.appendChild(timing);

  let commit = document.createElement("div");
  commit.className = "cell commit heading";
  commit.onclick = () => sortRows("commitHash");
  commit.appendChild(document.createTextNode("Commit"));
  div.appendChild(commit);

  let timestamp = document.createElement("div");
  timestamp.className = "cell timestamp heading";
  timestamp.onclick = () => sortRows("timeStamp");
  timestamp.appendChild(document.createTextNode("Timestamp"));
  div.appendChild(timestamp);
} // function createHeader(ul)

function createRows(record, ul) {
  function createHead(divHead, divBody, record, data) {
    divHead.className = "li-head toggle";
    divHead.onclick = () => divBody.classList.toggle("hidden");

    let status = document.createElement("div");
    let errorClass = classForDiff(data.pixelError);
    status.className = `cell status ${errorClass}`;
    status.appendChild(document.createTextNode(diffDisplay(data.pixelError)));
    divHead.appendChild(status);

    let group = document.createElement("div");
    group.className = "cell group";
    group.appendChild(document.createTextNode(record.group));
    divHead.appendChild(group);

    let name = document.createElement("div");
    name.className = "cell name";
    name.appendChild(document.createTextNode(record.name));
    divHead.appendChild(name);

    let hw = document.createElement("div");
    hw.className = "cell hardware";
    hw.appendChild(document.createTextNode(record.hardware));
    divHead.appendChild(hw);

    let timing = document.createElement("div");
    timing.className = "cell timing";
    timing.appendChild(document.createTextNode(timingDisplay(data.timing)));
    divHead.appendChild(timing);

    let commit = document.createElement("div");
    commit.className = "cell commit";
    let a = document.createElement("a");
    a.href = `https://github.com/OpenSpace/OpenSpace/commit/${data.commitHash}`;
    a.target = "_blank";
    a.appendChild(document.createTextNode(data.commitHash));
    commit.appendChild(a);
    divHead.appendChild(commit);

    let timestamp = document.createElement("div");
    timestamp.className = "cell timestamp";
    timestamp.appendChild(
      document.createTextNode(new Date(data.timeStamp).toISOString())
    );
    divHead.appendChild(timestamp);

    {
      let div = document.createElement("div");
      div.className = "cell candidate";

      let a = document.createElement("a");
      a.href = `/api/result/candidate/${record.group}/${record.name}/${record.hardware}`;
      a.target = "_blank";
      div.appendChild(a);

      let img = document.createElement("img");
      img.src = `/api/result/candidate-thumbnail/${record.group}/${record.name}/${record.hardware}`;
      img.className = "overview";
      img.loading = "lazy";
      a.appendChild(img);
      divHead.appendChild(div);
    }

    {
      let div = document.createElement("div");
      div.className = "cell reference";

      let a = document.createElement("a");
      a.href = `/api/result/reference/${record.group}/${record.name}/${record.hardware}`;
      a.target = "_blank";
      div.appendChild(a);

      let img = document.createElement("img");
      img.src = `/api/result/reference-thumbnail/${record.group}/${record.name}/${record.hardware}`;
      img.className = "overview";
      img.loading = "lazy";
      a.appendChild(img);
      divHead.appendChild(div);
    }

    {
      let div = document.createElement("div");
      div.className = "cell difference";

      let a = document.createElement("a");
      a.href = `/api/result/difference/${record.group}/${record.name}/${record.hardware}`;
      a.target = "_blank";
      div.appendChild(a);

      let img = document.createElement("img");
      img.src = `/api/result/difference-thumbnail/${record.group}/${record.name}/${record.hardware}`;
      img.className = "overview";
      img.loading = "lazy";
      a.appendChild(img);
      divHead.appendChild(div);
    }

    return divHead;
  } // function createHead(divHead, divBody, record, data)

  function createBody(divBody, record,  testData) {
    divBody.className = "li-body hidden";

    let table = document.createElement("table");
    table.className = "history";
    divBody.appendChild(table);


    testData = testData.reverse();
    let trStatus = document.createElement("tr");
    for (let data of testData) {
      let td = document.createElement("td");
      let errorClass = classForDiff(data.pixelError);
      td.className = `status-small ${errorClass}`;
      trStatus.appendChild(td);
    }
    table.appendChild(trStatus);

    let trTimeStamp = document.createElement("tr");
    for (let data of testData) {
      let td = document.createElement("td");
      td.className = "timestamp";
      td.appendChild(document.createTextNode(new Date(data.timeStamp).toUTCString()));
      trTimeStamp.appendChild(td);
    }
    table.appendChild(trTimeStamp);

    let trDiff = document.createElement("tr");
    for (let data of testData) {
      let td = document.createElement("td");
      td.className = "diff";
      td.appendChild(document.createTextNode(diffDisplay(data.pixelError)));
      trDiff.appendChild(td);
    }
    table.appendChild(trDiff);

    let trCommit = document.createElement("tr");
    for (let data of testData) {
      let td = document.createElement("td");
      td.className = "commit";
      let a = document.createElement("a");
      a.href = `https://github.com/OpenSpace/OpenSpace/commit/${data.commitHash}`;
      a.target = "_blank";
      td.appendChild(a);
      a.appendChild(document.createTextNode(data.commitHash));
      trCommit.appendChild(td);
    }
    table.appendChild(trCommit);

    let trTiming = document.createElement("tr");
    for (let data of testData) {
      let td = document.createElement("td");
      td.className = "timing";
      td.appendChild(document.createTextNode(timingDisplay(data.timing)));
      trTiming.appendChild(td);
    }
    table.appendChild(trTiming);

    let trLog = document.createElement("tr");
    for (let data of testData) {
      let td = document.createElement("td");
      td.className = "log";
      let a = document.createElement("a");
      a.href = `/api/result/log/${record.group}/${record.name}/${record.hardware}/${data.timeStamp}`;
      a.target = "_blank";
      td.appendChild(a);
      a.appendChild(document.createTextNode(`Log file (${data.nErrors} errors)`));
      trLog.appendChild(td);
    }
    table.appendChild(trLog);

    let trCandidate = document.createElement("tr");
    for (let data of testData) {
      let td = document.createElement("td");
      td.className = "candidate";
      trCandidate.appendChild(td);

      let a = document.createElement("a");
      a.href = `/api/result/candidate/${record.group}/${record.name}/${record.hardware}/${data.timeStamp}`;
      a.target = "_blank";
      td.appendChild(a);

      let img = document.createElement("img");
      img.src = `/api/result/candidate-thumbnail/${record.group}/${record.name}/${record.hardware}/${data.timeStamp}`;
      img.loading = "lazy";
      a.appendChild(img);
    }
    table.appendChild(trCandidate);

    let trReference = document.createElement("tr");
    for (let data of testData) {
      let td = document.createElement("td");
      td.className = "reference";
      trReference.appendChild(td);

      let a = document.createElement("a");
      a.href = `/api/result/reference/${record.group}/${record.name}/${record.hardware}/${data.timeStamp}`;
      a.target = "_blank";
      td.appendChild(a);

      let img = document.createElement("img");
      img.src = `/api/result/reference-thumbnail/${record.group}/${record.name}/${record.hardware}/${data.timeStamp}`;
      img.loading = "lazy";
      a.appendChild(img);
    }
    table.appendChild(trReference);

    let trDifference = document.createElement("tr");
    for (let data of testData) {
      let td = document.createElement("td");
      td.className = "difference";
      trDifference.appendChild(td);

      let a = document.createElement("a");
      a.href = `/api/result/difference/${record.group}/${record.name}/${record.hardware}/${data.timeStamp}`;
      a.target = "_blank";
      td.appendChild(a);

      let img = document.createElement("img");
      img.src = `/api/result/difference-thumbnail/${record.group}/${record.name}/${record.hardware}/${data.timeStamp}`;
      img.loading = "lazy";
      a.appendChild(img);
    }
    table.appendChild(trDifference);
  } // function createBody(divBody, record, testData)


  let li = document.createElement("li");
  li.className = "row";
  li.record = record;
  ul.appendChild(li);

  let divHead = document.createElement("div");
  let divBody = document.createElement("div");

  createHead(divHead, divBody, record, record.data[record.data.length - 1]);
  li.appendChild(divHead);

  createBody(divBody, record, record.data);
  li.appendChild(divBody);
} // function createRows(record, ul)

async function main() {
  let records = await fetch("/api/test-records").then(res => res.json());

  // Sort by the highest latest pixel difference are first
  records.sort((a, b) => a.data[a.data.length - 1].pixelError < b.data[b.data.length - 1].pixelError);

  let list = document.getElementById("list");
  createHeader(list);

  for (let record of records) {
    console.assert(record.data.length > 0);
    createRows(record, list);
  }

}

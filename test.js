function loadHandler() {
  console.log("loaded");
  execute(10).then(display).then(function() {
    return execute(100).then(display);
  }).then(function() {
    return execute(1000).then(display);
  }).then(function() {
    return execute(10000).then(display);
  });
}

function display(result) {
  console.log('chunks: ' + result.numChunks +
              ' sync: ' + result.sync + ' (' +
                (result.sync / result.numChunks) + '/chunk)' +
              ' promise: ' + result.promise + ' (' +
                (result.promise / result.numChunks) + '/chunk)');
}

function makePromiseReader(numChunks) {
  var data = new Array(numChunks);
  for (var i = 0; i < data.length; ++i) {
    data[i] = new ArrayBuffer(1024);
  }
  var nextChunk = 0;

  return {
    read: function() {
      return new Promise(function(resolve, reject) {
        if (nextChunk >= data.length) {
          resolve({ value: undefined, done: true });
          return;
        }
        resolve({ value: data[nextChunk++], done: false });
      });
    }
  };
}

function executePromise(numChunks) {
  var reader = makePromiseReader(numChunks);
  var start = performance.now();
  return new Promise(function(resolve, reject) {
    function handleChunk(result) {
      if (result.done) {
        var end = performance.now();
        resolve(end - start);
        return;
      }
      reader.read().then(handleChunk);
    }

    reader.read().then(handleChunk).catch(reject);
  });
}

function makeSyncReader(numChunks) {
  var data = new Array(numChunks);
  for (var i = 0; i < data.length; ++i) {
    data[i] = new ArrayBuffer(1024);
  }
  var nextChunk = 0;

  return {
    read: function() {
      if (nextChunk >= data.length) {
        return { value: undefined, done: true };
      }
      return { value: data[nextChunk++], done: false };
    }
  };
}

function executeSync(numChunks) {
  var reader = makeSyncReader(numChunks);
  var done = false;
  var start = performance.now();
  do
  {
    done = reader.read().done;
  } while(!done);
  var end = performance.now();
  return end - start;
}

function execute(numChunks) {
  var syncTime = executeSync(numChunks);
  return executePromise(numChunks).then(function (dur) {
    return { numChunks: numChunks, sync: syncTime, promise: dur };
  });
}

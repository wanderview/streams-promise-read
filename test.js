var suite = new Benchmark.Suite();

suite
.add('sync', function (deferred) {
  executeSync(10);
  deferred.resolve();
}, { defer: true })
.add('promise', function (deferred) {
  executePromise(10).then(function () {
    deferred.resolve();
  });
}, { defer: true })
.on('cycle', function (event) {
  console.log(event.target.toString());
})
.on('complete', function (event) {
  console.log('Fastest is', this.filter('fastest').pluck('name'));
})
.on('error', function (event) {
  console.log('Error has occured: "' + event.target.error.message + '" in ' + event.target.name);
})
.run();

/*function loadHandler() {
  console.log("loaded");
  execute(100).then(function() {
    return execute(10).then(display);
  }).then(function() {
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
                (result.promise / result.numChunks) + '/chunk)' +
              ' ratio: ' + result.promise / result.sync);
}*/

function makePromiseReader(numChunks) {
  var data = new Array(numChunks);
  for (var i = 0; i < data.length; ++i) {
    data[i] = new ArrayBuffer(128);
  }
  var nextChunk = 0;

  return {
    read: function() {
      if (nextChunk >= data.length) {
        return Promise.resolve({ value: undefined, done: true });
      }
      return Promise.resolve({ value: data[nextChunk++], done: false });
    }
  };
}

function executePromise(numChunks) {
  var reader = makePromiseReader(numChunks);

  return reader.read().then(handleChunk);

  function handleChunk(result) {
    if (result.done) {
      return;
    }

    // Avoid loop being optimized away
    if (result.value[0] > 0) {
      throw new Error('this should never happen');
    }

    return reader.read().then(handleChunk);
  }
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
  var result;

  while (true) {
    result = reader.read();

    if (result.done) {
      return;
    }

    // Avoid loop being optimized away
    if (result.value[0] > 0) {
      throw new Error('this should never happen');
    }
  }
}

function execute(numChunks) {
  var syncTime = executeSync(numChunks);
  return executePromise(numChunks).then(function (dur) {
    return { numChunks: numChunks, sync: syncTime, promise: dur };
  });
}

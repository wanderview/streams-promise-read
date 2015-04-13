function execute(name, func) {
  var auto = false;
  var numChunks = 1;
  var chunkSize = 1;

  try {
    var u = new URL(window.location);
    var params = new URLSearchParams(u.search.substr(1));
    var chunks = params.get('chunks');
    if (chunks === 'auto') {
      auto = true;
    } else if (~~chunks > 0) {
      numChunks = ~~chunks;
    }
    var size = ~~params.get('size');
    if (size > 0) {
      chunkSize = size;
    }
  } catch(e) {
    // if we can't get a numChunks override, just use default
  }

  function test(numChunks) {
    return runTest(name, func, numChunks, chunkSize);
  }

  if (auto) {
    numChunks = 1;

    function nextTest() {
      if (numChunks >= 8192) {
        return;
      }
      numChunks *= 2;
      return test(numChunks).then(nextTest);
    }

    test(numChunks).then(nextTest);
  } else {
    test(numChunks);
  }
}

function runTest(name, func, numChunks, chunkSize) {
  return new Promise(function(resolve, reject) {
    var suite = new Benchmark.Suite();

    display('---------------');
    display('Testing ' + numChunks + ' chunks of ' + chunkSize + ' bytes per operation.');

    suite
    .add(name, function (deferred) {
      func(numChunks, chunkSize).then(function() {
        deferred.resolve();
      });
    }, { defer: true })
    .on('cycle', function (event) {
      display(event.target.toString());
    })
    .on('complete', function (event) {
      display('Fastest is ' + this.filter('fastest').pluck('name'));
      resolve();
    })
    .on('error', function (event) {
      display('Error has occured: "' + event.target.error.message + '" in ' +
              event.target.name);
      reject(event.target);
    })
    .run();
  });
}

function display(value) {
  var resultList = document.getElementById('output');
  var result = document.createElement('div');
  result.textContent = value;
  resultList.appendChild(result);
}

function makePromiseReader(numChunks, chunkSize) {
  var data = new Array(numChunks);
  for (var i = 0; i < data.length; ++i) {
    data[i] = new ArrayBuffer(chunkSize);
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

function executePromise(numChunks, chunkSize) {
  var reader = makePromiseReader(numChunks, chunkSize);

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

function makeSyncReader(numChunks, chunkSize) {
  var data = new Array(numChunks);
  for (var i = 0; i < data.length; ++i) {
    data[i] = new ArrayBuffer(chunkSize);
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

function executeSync(numChunks, chunkSize) {
  var reader = makeSyncReader(numChunks, chunkSize);
  var result;

  while (true) {
    result = reader.read();

    if (result.done) {
      // Use a real promise here to note completion in async fashion.  This is
      // necessary to avoid benchmark.js hitting our nested setTimeout()
      // throttling.
      return Promise.resolve();
    }

    // Avoid loop being optimized away
    if (result.value[0] > 0) {
      throw new Error('this should never happen');
    }
  }
}

var id3 = require('../lib/index'),
      fs = require('fs'),
      assert = require('assert'),
      testsRan = 0;
        
var parser = new id3(fs.createReadStream('samples/id3v2.4.mp3'));

parser.on('metadata', function(result){
    assert.equal(result.title, 'Home');
    assert.deepEqual(result.artist, ['Explo','ions','nodejsftws']);
    assert.equal(result.albumartist, 'Soundtrack');
    assert.equal(result.album, 'Friday Night Lights [Original Movie Soundtrack]');
    assert.equal(result.year, 2004);
    assert.equal(result.track, 5);
    assert.deepEqual(result.disk, [1, 1]);
    assert.equal(result.genre, 'Soundtrack');
    testsRan += 8;
});

parser.on('TALB', function(result){
    assert.equal(result, 'Friday Night Lights [Original Movie Soundtrack]');
    testsRan++;
});

parser.on('TPE1', function(result){
    assert.deepEqual(result, ['Explo','ions','nodejsftws']);
    testsRan++;
});

parser.on('TPE2', function(result){
    assert.equal(result, 'Soundtrack');
    testsRan++;
});

parser.on('TCOM', function(result){
    assert.equal(result, 'Explosions in the Sky');
    testsRan++;
});

parser.on('TPOS', function(result){
    assert.equal(result, '1/1');
    testsRan++;
});

parser.on('TCON', function(result){
    assert.equal(result, 'Soundtrack');
    testsRan++;
});

parser.on('TIT2', function(result){
    assert.equal(result, 'Home');
    testsRan++;
});

parser.on('TRCK', function(result){
    assert.equal(result, 5);
    testsRan++;
});

parser.on('TDRC', function(result){
    assert.equal(result, 2004);
    testsRan++;
});

parser.on('APIC', function(result){
    assert.equal(result.format, 'image/jpg');
    assert.equal(result.type, 'Cover (front)');
    assert.equal(result.description, 'some description');
    assert.equal(result.data.length, 80938);
    testsRan += 4;
});

// TODO: test/impl for TXXX

parser.on('done', function(result){
    assert.equal(testsRan, 21);
    console.log(__filename + ' ran ' + testsRan + ' tests');
});

parser.parse();
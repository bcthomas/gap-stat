var expect = require('chai').expect,
    gs = require('../lib/gap_stat'),
    _ = require('underscore');

describe('gap_statistic', function() {
  it('transforms an array', function() {
    var d = [[1,2,6],[6,7,8],[5,9,2]],
    result = gs.t(d);
    expect(result).to.eql([[1,6,5],[2,7,9],[6,8,2]]);
  });

  it('calculates column mins for an array', function() {
    var d = [[1,2,6],[6,7,8],[5,9,2]],
    result = gs.column_mins(d);
    expect(result).to.eql([1,2,2]);
  });

  it('calculates column maxs for an array', function() {
    var d = [[1,2,6],[6,7,8],[5,9,2]],
    result = gs.column_maxs(d);
    expect(result).to.eql([6,9,8]);
  });

  it('calculates column means for an array', function() {
    var d = [[1,2,6],[6,7,8],[5,9,1]],
    result = gs.column_means(d);
    expect(result).to.eql([4, 6, 5]);
  });

  it('calculates column sums for an array', function() {
    var d = [[1,2,6],[6,7,8],[5,9,1]],
    result = gs.column_sums(d);
    expect(result).to.eql([12, 18, 15]);
  });

  it('calculates a random uniform distribution', function() {
    var d = [[1,2,90],[2,7,98],[3,9,92],[1,3,95]],
    result = gs.generate_uniform_points(d),
    i;
    expect(result.length).to.eql(4);
    for (i = 0; i < result.length; i++) {
      expect(result[i][0]).to.be.at.least(1);
      expect(result[i][0]).to.be.at.most(3);
      expect(result[i][1]).to.be.at.least(2);
      expect(result[i][1]).to.be.at.most(9);
      expect(result[i][2]).to.be.at.least(90);
      expect(result[i][2]).to.be.at.most(98);
    }
  });
  it('calculates a neg random uniform distribution', function() {
    var d = [[-10,2,90],[2,7,98],[3,9,92],[1,3,95]],
    result = gs.generate_uniform_points(d),
    i;
    expect(result.length).to.eql(4);
    for (i = 0; i < result.length; i++) {
      expect(result[i][0]).to.be.at.least(-10);
      expect(result[i][0]).to.be.at.most(3);
      expect(result[i][1]).to.be.at.least(2);
      expect(result[i][1]).to.be.at.most(9);
      expect(result[i][2]).to.be.at.least(90);
      expect(result[i][2]).to.be.at.most(98);
    }
  });



  it('calculates dispersion values for a matrix', function() {
    var result,
    d = [ [20,  20,  80 ],
          [22,  22,  90 ],
          [250, 255, 253],
          [0,   30,  70 ],
          [200, 0,   23 ],
          [100, 54,  100],
          [255, 13,  8  ] ];

    result = gs.dispersion(d, 1);
    expect(result).to.eql(11.99545);
  });

  it('suggests a cluster size', function() {
    var d = [ [-1.02952208,-1.07907971], [-1.42244106,-0.77685469], [1.20957982,1.44916984],
              [0.75422902,0.31325718],   [0.11739611,0.31789547],   [-0.08336038,-0.85734966],
              [-0.13455617,-1.19939493], [0.16428889,0.82445904],   [0.53838674,0.04016184],
              [-1.37482841,1.83023709],  [12.16005738,14.50359723], [13.64938680,16.74340669],
              [13.97670623,14.47556668], [14.45381993,14.05922083], [11.78413908,13.73136992],
              [13.26513677,13.65881786], [13.07723256,14.11303152], [10.24893248,16.38920158],
              [12.58798188,15.99102896], [14.21623940,16.23283015], [4.37277736,-1.55743599],
              [4.32721761,-0.04309912],  [5.98372265,0.46332098],   [4.32867184, 0.47974123],
              [5.11476706,-0.61566978],  [6.10444958,0.74085445],   [4.63408230,-0.36047843],
              [4.12358049,-0.77732542],  [5.31772144,0.56882625],   [3.49000895,-0.64345730] ],
        result = gs.gap_statistic(d, 1, 5);
    expect(result).to.eql(3);
  });
});



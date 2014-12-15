gap-stat
========

The gap statistic for K-means clustering.  Based on an R implementation
(https://github.com/echen/gap-statistic).

Depends on clusterfck (https://github.com/harthur/clusterfck) and
underscore (http://underscorejs.org).

# Install
```bash
npm install gap-stat
```

# Example

```javascript
var gs = require("gap-stat");

var d = [ [20, 20, 80],
          [22, 22, 90],
          [250, 255, 253],
          [0, 30, 70],
          [200, 0, 23],
          [100, 54, 100],
          [255, 13, 8] ];
var result = gs.gap_statistic(d, 1, 5);
console.log('best cluster size is '+result.cluster_size);

```


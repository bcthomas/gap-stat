var _  = require('underscore'),
    cf = require('clusterfck');

// define return class
//
var GapStatResult = function(cluster_size, gaps, gap_stddevs) {
  this.cluster_size = cluster_size;
  this.gaps = gaps;
  this.gap_stddevs = gap_stddevs;
};

// transpose array
function t(data) {
  return(_.each(_.zip.apply(_, data), function() {}));
}

// round a number to the given number of places
function round_to(num, places) {
  var places = typeof places !== 'undefined' ? places : 1,
      mx;
  mx = Math.pow(10, places);
  return(Math.round(num * mx) / mx);
}

function column_mins(data) {
  var mins = [];
  _.each(t(data), function(e) {
    mins.push(_.min(e));
  })
  return(mins);
}

function column_maxs(data) {
  var maxs = [];
  _.each(t(data), function(e) {
    maxs.push(_.max(e));
  })
  return(maxs);
}

function column_means(data) {
  var means = [];
  _.each(t(data), function(e) {
    means.push(_.reduce(e, function(a, b) { return a + b; }, 0) / e.length);
  })
  return(means);
}

function column_sums(data) {
  var sums = [];
  _.each(t(data), function(e) {
    sums.push(_.reduce(e, function(a, b) { return a + b; }, 0));
  })
  return(sums);
}

//random_int_from_interval
function random_int_from_interval(min, max) {
  return(Math.floor(Math.random() * (max - min + 1) + min));
};

// generates a random matrix of data with uniform values that
// mirrors the input matrix
function generate_uniform_points(data) {
  var mins = column_mins(data),
      maxs = column_maxs(data),
      n = data.length,
      temp = [],
      output = [],
      i, j;

  for (j = 0; j < data[0].length; j++) {
    for (i = 0; i < n; i++) {
      temp.push(Math.floor(random_int_from_interval(mins[j], maxs[j])));
    }
    output.push(temp.slice(0)); // copy values to output array
    while(temp.length > 0) { temp.pop(); } // really clear the array, and fast!
  }
  // return the transposed matrix
  return(t(output));
};

// Calculate log(sum_i(within-cluster_i sum of squares around cluster_i mean)).
// This is a single value, indep. of num_clusters
function dispersion(data, num_clusters) {
  var clusters = cf.kmeans(data, num_clusters),
      temp_a = [], cluster_means = [], j;

  // Take the sum, over each cluster, of the within-cluster sum of squares around
  // the cluster mean. Then take the log. This is `W_k` in TWH's notation.
  _.each(clusters, function(c,i) {
    // get column means and round them to 5 places
    cluster_means = _.map(column_means(c), function(x) {
      return(round_to(x, 5));
    });

    for (j = 0; j < cluster_means.length; j++) {
      _.each(c, function(e) {
        temp_a.push(round_to(Math.pow((e[j] - cluster_means[j]), 2), 2));
      });
    }
  });
  
  // round to 5 decimal places
  //var dispersion = round_to(Math.log(_.reduce(temp_a, function(memo, n) { return(memo+n); }, 0)), 5);
  //return(dispersion);
  return(round_to(Math.log(_.reduce(temp_a, function(memo, n) { return(memo+n); }, 0)), 5));
}

// "For an appropriate reference distribution (in this case, uniform
// points in the same range as `data`), simulate the mean and standard
// deviation of the dispersion."
function reference_dispersion(data, num_clusters, num_reference_bootstraps) {
  var dispersions = [],
      deviates = [],
      mean_dispersion = 0,
      sd_dispersion = 0;

  // generate num_reference_bootstraps dispersion values from uniform
  // randomly-generated samples - save each dispersion value in
  // dispersions array
  _.times(num_reference_bootstraps, function(x) {
    //dispersions.push(dispersion(generate_uniform_points(data)));
    var dd = generate_uniform_points(data);
    var dd_disp = dispersion(dd, num_clusters);
    dispersions.push(dd_disp);
  });
  // calculate the mean
  mean_dispersion = _.reduce(dispersions, function(a,b) { return a + b; }, 0) / dispersions.length;

  // generate deviations for the dispersions array
  deviates = _.map(dispersions, function(a) {
    return(Math.pow(a - mean_dispersion, 2));
  });

  // calculate the std deviation for the deviates
  sd_dispersion = Math.sqrt(
      _.reduce(deviates, function(a,b) { return a + b; }, 0) / deviates.length
    ) / Math.sqrt(1 + 1 / num_reference_bootstraps);

  return([mean_dispersion, sd_dispersion]);
}

/*
 * gap_statistic
 * @param data matrix
 * @return cluster count
 */
function gap_statistic(data, min_cluster, max_cluster, bootstrap_count, verbose) {
  var verbose = typeof verbose !== 'undefined' ? verbose : false,
      min_cluster = typeof min_cluster !== 'undefined' ? min_cluster : 1,
      max_cluster = typeof max_cluster !== 'undefined' ? max_cluster : 10,
      bootstrap_count = typeof bootstrap_count !== 'undefined' ? bootstrap_count : 10,
      num_clusters = _.range(min_cluster, max_cluster+1),
      actual_dispersions = [],
      ref_dispersions = [],
      mean_ref_dispersions = [],
      sd_ref_dispersions = [],
      gaps = [],
      j,
      gap_max = -Infinity,
      cluster_ndx;

  if (verbose) {
    console.log('running gap_statistic()');
    console.log(' min_cluster = '+min_cluster);
    console.log(' max_cluster = '+max_cluster);
    console.log(' bootstrap_count = '+bootstrap_count);
    console.log(' num_clusters = '+num_clusters);
  }

  _.each(num_clusters, function(n) {
    actual_dispersions.push(dispersion(data, n));
  });

  _.each(num_clusters, function(n) {
    ref_dispersions.push(reference_dispersion(data, n, bootstrap_count));
  });

  _.each(ref_dispersions, function(e) {
    mean_ref_dispersions.push(e[0]);
    sd_ref_dispersions.push(e[1]);
  });

  _.each(actual_dispersions, function(e, i) {
    gaps.push(mean_ref_dispersions[i] - e);
  });

  for(j = 0; j < gaps.length; j++) {
    if (gaps[j] > gap_max) {
      gap_max = gaps[j];
      cluster_ndx = j + 1;
    }
  }

  if (verbose) { console.log('suggested clusters = '+cluster_ndx); }
  return(new GapStatResult(cluster_ndx, gaps, sd_ref_dispersions));
};

module.exports = {
  GapStatResult: GapStatResult,
  t: t,
  transpose: t,
  column_mins: column_mins,
  column_maxs: column_maxs,
  column_means: column_means,
  column_sums: column_sums,
  generate_uniform_points: generate_uniform_points,
  dispersion: dispersion,
  reference_dispersion: reference_dispersion,
  gap_statistic: gap_statistic
};

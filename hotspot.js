// Rule-based hotspot analysis over the incrementally-averaged VD stats.
// Not a real traffic engineering model -- just simple heuristics for a fun/reference dashboard.

const PEAK_AM_HOURS = [7, 8, 9];
const PEAK_PM_HOURS = [17, 18, 19];
const OFFPEAK_HOURS = [22, 23, 0, 1];
const MIN_BUCKET_SAMPLES = 2; // need at least this many polls in a bucket to trust it
const MIN_OFFPEAK_SAMPLES = 4; // combined across offpeak hours

function weightedAvg(buckets, dayType, hours) {
  let sum = 0;
  let count = 0;
  for (const h of hours) {
    const key = `${dayType}-${String(h).padStart(2, "0")}`;
    const bucket = buckets[key];
    if (bucket && bucket.count >= MIN_BUCKET_SAMPLES) {
      sum += bucket.sum;
      count += bucket.count;
    }
  }
  return count > 0 ? { avg: sum / count, count } : { avg: null, count: 0 };
}

function analyzeVd(vdStats) {
  const buckets = vdStats?.buckets || {};

  const am = weightedAvg(buckets, "weekday", PEAK_AM_HOURS);
  const pm = weightedAvg(buckets, "weekday", PEAK_PM_HOURS);
  const offpeak = weightedAvg(buckets, "weekday", OFFPEAK_HOURS);

  if (offpeak.count < MIN_OFFPEAK_SAMPLES) {
    return { status: "collecting", message: "資料收集中,尚不足以判斷模式" };
  }

  const amRatio = am.avg != null ? am.avg / offpeak.avg : null;
  const pmRatio = pm.avg != null ? pm.avg / offpeak.avg : null;

  const worstRatio = [amRatio, pmRatio].filter((r) => r != null).sort((a, b) => a - b)[0];

  if (worstRatio == null) {
    return { status: "collecting", message: "尖峰時段資料尚不足" };
  }

  const amFlag = amRatio != null && amRatio < 0.6;
  const pmFlag = pmRatio != null && pmRatio < 0.6;

  if (amFlag && pmFlag) {
    return {
      status: "hotspot",
      severity: "high",
      message: `早晚尖峰皆明顯壅塞(離峰均速約 ${offpeak.avg.toFixed(0)} km/h,早尖峰 ${am.avg.toFixed(0)}、晚尖峰 ${pm.avg.toFixed(0)} km/h)`,
      suggestion: "建議:評估此路段是否可增設公車專用道或調整路邊停車格,並檢討尖峰時段號誌時相分配。",
    };
  }
  if (amFlag) {
    return {
      status: "hotspot",
      severity: "medium",
      message: `早尖峰明顯壅塞(離峰均速約 ${offpeak.avg.toFixed(0)} km/h,早尖峰 ${am.avg.toFixed(0)} km/h)`,
      suggestion: "建議:檢討早尖峰號誌時相,或評估周邊學校/上班人潮尖峰疏導動線。",
    };
  }
  if (pmFlag) {
    return {
      status: "hotspot",
      severity: "medium",
      message: `晚尖峰明顯壅塞(離峰均速約 ${offpeak.avg.toFixed(0)} km/h,晚尖峰 ${pm.avg.toFixed(0)} km/h)`,
      suggestion: "建議:檢討晚尖峰號誌時相,評估路口容量或替代分流路線。",
    };
  }
  if (worstRatio < 0.8) {
    return {
      status: "mild",
      message: `尖峰時段車速略低於離峰(比值 ${worstRatio.toFixed(2)}),尚未達明顯壅塞門檻`,
      suggestion: null,
    };
  }
  return {
    status: "normal",
    message: "尖峰與離峰車速差異不大,暫無明顯壅塞跡象",
    suggestion: null,
  };
}

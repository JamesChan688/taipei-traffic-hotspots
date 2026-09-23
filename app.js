const STATUS_COLOR = {
  hotspot: "#d64545",
  mild: "#e0a83a",
  normal: "#2f9e59",
  collecting: "#8a8a8a",
};

const STATUS_LABEL = {
  hotspot: "壅塞熱點",
  mild: "輕微壅塞",
  normal: "尚無明顯壅塞",
  collecting: "資料收集中",
};

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`無法載入 ${path}`);
  return res.json();
}

function formatSpeed(v) {
  return v == null ? "—" : `${v.toFixed(1)} km/h`;
}

async function main() {
  const metaLine = document.getElementById("meta-line");
  const hotspotList = document.getElementById("hotspot-list");

  let vdMeta;
  let linkStats;

  try {
    vdMeta = await loadJson("data/vd-meta.json");
  } catch (err) {
    metaLine.textContent = "載入偵測器清單失敗";
    return;
  }

  try {
    linkStats = await loadJson("data/link-stats.json");
  } catch (err) {
    linkStats = { vds: {} };
  }

  const map = L.map("map").setView([vdMeta.center.lat, vdMeta.center.lon], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  L.rectangle(
    [
      [vdMeta.boundingBox.minLat, vdMeta.boundingBox.minLon],
      [vdMeta.boundingBox.maxLat, vdMeta.boundingBox.maxLon],
    ],
    { color: "#e8663c", weight: 1, fillOpacity: 0.05, dashArray: "4 4" }
  ).addTo(map);

  hotspotList.innerHTML = "";

  let totalPolls = 0;

  vdMeta.vds.forEach((vd) => {
    const stats = linkStats.vds?.[vd.vdId];
    const analysis = analyzeVd(stats);
    const color = STATUS_COLOR[analysis.status];

    if (stats) {
      const counts = Object.values(stats.buckets || {}).map((b) => b.count);
      totalPolls = Math.max(totalPolls, ...counts, 0);
    }

    L.circleMarker([vd.lat, vd.lon], {
      radius: 10,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 2,
    })
      .addTo(map)
      .bindPopup(
        `<strong>${vd.roadName}</strong><br>目前車速:${formatSpeed(stats?.lastSpeed)}<br>${STATUS_LABEL[analysis.status]}`
      );

    const card = document.createElement("div");
    card.className = `hotspot-card status-${analysis.status}`;

    const title = document.createElement("div");
    title.className = "hotspot-title";
    title.innerHTML = `<span class="dot" style="background:${color}"></span> <strong>${vd.roadName}</strong> <span class="badge">${STATUS_LABEL[analysis.status]}</span>`;

    const current = document.createElement("div");
    current.className = "hotspot-current";
    current.textContent = `目前車速:${formatSpeed(stats?.lastSpeed)}`;

    const message = document.createElement("div");
    message.className = "hotspot-message";
    message.textContent = analysis.message;

    card.append(title, current, message);

    if (analysis.suggestion) {
      const suggestion = document.createElement("div");
      suggestion.className = "hotspot-suggestion";
      suggestion.textContent = analysis.suggestion;
      card.appendChild(suggestion);
    }

    hotspotList.appendChild(card);
  });

  const updatedAt = linkStats.updatedAt ? new Date(linkStats.updatedAt).toLocaleString("zh-TW") : "尚未有資料";
  metaLine.textContent = `資料最後更新:${updatedAt} · 監測 ${vdMeta.vds.length} 個路段 · 每個路段累積樣本上限 ${totalPolls} 筆`;
}

main();

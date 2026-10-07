// src/lib/gpxUtils.ts

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function processAndCropGpx(file: File): Promise<string> {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");
  const trkpts = Array.from(xmlDoc.getElementsByTagName("trkpt"));

  if (trkpts.length < 3) return text;

  const points = trkpts.map((pt) => ({
    lat: parseFloat(pt.getAttribute("lat") || "0"),
    lon: parseFloat(pt.getAttribute("lon") || "0"),
    node: pt,
  }));

  let distFromStart = 0;
  const distancesFromStart: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    distFromStart += getDistanceFromLatLonInMeters(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon,
    );
    distancesFromStart.push(distFromStart);
  }

  const totalDist = distancesFromStart[distancesFromStart.length - 1];

  // Rogne 200m au début et 200m à la fin pour la vie privée
  const filteredTrkpts = points.filter((_, index) => {
    const dStart = distancesFromStart[index];
    const dEnd = totalDist - dStart;
    return dStart >= 200 && dEnd >= 200;
  });

  if (filteredTrkpts.length < 2) return text;

  const parentTrkseg = filteredTrkpts[0].node.parentElement;
  if (parentTrkseg) {
    parentTrkseg.innerHTML = "";
    filteredTrkpts.forEach((p) => parentTrkseg.appendChild(p.node));
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(xmlDoc);
}

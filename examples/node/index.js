import L from "leaflet";
// import vis from "vis-timeline/dist/vis-timeline-graph2d.min";
// import vis from "vis-timeline/dist/vis-timeline-graph2d.esm.js";
// import vis from "vis-timeline";
import { Chronomap } from "chronomap";
import "vis-timeline/dist/vis-timeline-graph2d.min.css";

const htmlRefs = {
  leaflet: document.getElementsByClassName("chronomap__map")[0],
  timeline: document.getElementsByClassName("chronomap__timeline")[0]
};

const sampleDatasetOne = [
  {
    id: 1,
    name: "New York City",
    state: "New York",
    fromDate: "2019-04-01 00:00",
    toDate: "2019-05-01 23:59",
    latitude: 40.7128,
    longitude: -74.006
  },
  {
    id: 2,
    name: "Boston",
    state: "Massachusetts",
    fromDate: "2019-09-01 00:00",
    toDate: "2019-10-01 23:59",
    latitude: 42.3601,
    longitude: -71.0589
  }
];

const sampleDatasetTwo = [
  {
    id: 3,
    name: "Toronto",
    state: "Ontario",
    fromDate: "2019-06-01 00:00",
    toDate: null,
    latitude: 43.6532,
    longitude: -79.3832
  }
];

const canadaGroupName = "Canada";
const usaGroupName = "USA";

/**
 * @param {Object} itemData
 * @return {CreatedMarkerPropertiesType}
 */
const createMarkerPropertiesCallback = itemData => ({
  id: itemData.id,
  longitude: itemData.longitude,
  latitude: itemData.latitude
});

/**
 * @param {Object} itemData
 * @return {CreatedTimelineItemType}
 */
const createTimelineItemCallback = itemData => ({
  id: itemData.id,
  content: itemData.name,
  group: canadaGroupName,
  start: itemData.fromDate,
  end: itemData.toDate,
  type: "range"
});

/**
 * @param {Object} itemData
 * @return {string}
 */
const markerPopupRendererCallback = itemData => {
  return `<p><b>${itemData.name}</b> (${itemData.state})</p>`;
};

const timelineOptions = {
  minHeight: 200,
  maxHeight: 400,
  verticalScroll: true,
  stack: true
};

const mapInstance = L.map(htmlRefs.leaflet, {
  center: L.latLng(41.39, -78.1),
  zoom: 14,
  preferCanvas: true,
  renderer: L.canvas()
});
const chronomap = new Chronomap(
  mapInstance,
  htmlRefs.timeline,
  timelineOptions
);

chronomap.init();

chronomap.populate(
  sampleDatasetOne,
  canadaGroupName,
  createMarkerPropertiesCallback,
  createTimelineItemCallback,
  markerPopupRendererCallback
);

chronomap.populateWithCustomMarker(
  sampleDatasetTwo,
  usaGroupName,
  function(itemData) {
    const markerOptions = {
      id: itemData.id
    };

    const marker = new L.marker(
      [itemData.latitude, itemData.longitude],
      markerOptions
    ).on("click", e => console.log(`Clicked marker of ${itemData.name}`));

    marker.bindPopup(markerPopupRendererCallback(itemData));

    return marker;
  },
  function(itemData) {
    return {
      id: itemData.id,
      content: itemData.name,
      group: usaGroupName,
      start: itemData.fromDate,
      type: "point"
    };
  }
);


document
.getElementsByName("panToNewYorkBtn")[0]
.addEventListener("click", function(event) {
  chronomap.panMapAndTimelineByItemId(1);
});

document
.getElementsByName("panToBostonBtn")[0]
.addEventListener("click", function(event) {
  chronomap.panMapAndTimelineByItemId(2);
});

document
.getElementsByName("panToTorontoBtn")[0]
.addEventListener("click", function(event) {
  chronomap.panMapAndTimelineByItemId(3);
});

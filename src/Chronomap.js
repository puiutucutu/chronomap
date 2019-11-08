import { DataSet, Timeline } from "vis-timeline";

/**
 * @typedef {Object} CreatedMarkerPropertiesType
 * @property {string} id
 * @property {number} longitude
 * @property {number} latitude
 */

/**
 * @typedef {Object} CreatedTimelineItemType
 * @property {string} id
 * @property {string} content - The text to be displayed in the Timeline item.
 * @property {string} group - The group layer name.
 * @property {string|Date} start - A valid date.
 * @property {string|Date} [end] - A valid date. Required if `type` will be
 *   `range`. Otherwise, not required nor used for `type` of `box` or `point.
 * @property {string} [type] - The timeline item type to be displayed. See
 *   https://visjs.github.io/vis-timeline/docs/timeline/#items.
 */

const noop = () => {};

class Chronomap {
  /* @type {L.Map} */
  map;
  timelineHtmlRef;
  timelineOptions = {};
  /* @type {Timeline} */
  timeline;
  /* @type {DataSet} */
  timelineGroups = new DataSet();
  /* @type {DataSet} */
  timelineItems = new DataSet();

  /**
   * @type {{ leafletMarker: Function, timelineItem: Function }}
   */
  onClickCallbacks = {
    leafletMarker: noop,
    timelineItem: noop
  };

  /**
   * Stores references to FeatureGroup layers that are used to manage and
   * store markers into logical groups.
   *
   * Note that these FeatureGroup layers are used as the overlay layers in
   * the Leaflet map.
   *
   * @type {Map<string, L.FeatureGroup>} A layer name mapped to a Leaflet
   *   FeatureGroup layer.
   */
  leafletMarkerLayers = new Map();

  /**
   * @type {L.Control}
   */
  leafletControlLayer;

  /**
   * @type {boolean}
   */
  hasControlLayerBeenAddedToMap = false;

  /**
   * @param {L.Map} map An instance of a Leaflet map
   * @param {HTMLElement} timelineHtmlRef
   * @param {Object} [timelineOptions]
   */
  constructor(map, timelineHtmlRef, timelineOptions = {}) {
    this.map = map;
    this.timelineHtmlRef = timelineHtmlRef;
    this.timelineOptions = timelineOptions;
  }

  init() {
    this.makeTimeline();
  }

  /**
   * @private
   */
  makeTimeline() {
    this.timeline = new Timeline(this.timelineHtmlRef, [], this.timelineOptions) // prettier-ignore
    this.timeline.setGroups(this.timelineGroups);
    this.timeline.setItems(this.timelineItems);
    this.timeline.fit();
  }

  /**
   * Creates a leaflet control (if it does not exist) for handling the toggling
   * of marker and timeline item groups.
   */
  addLayerControlOnce() {
    if (!this.hasControlLayerBeenAddedToMap) {
      this.hasControlLayerBeenAddedToMap = true;
      this.leafletControlLayer = L.control
        .layers(null, null, { collapsed: false })
        .addTo(this.map)
      ;
    }
  }

  /**
   * Register a callback function on map marker click event.
   *
   * @param {function(x: MouseEvent): *} callback Function that will be
   *   provided a click event object when some map marker is clicked.
   */
  onMapMarkerClick(callback) {
    if (typeof callback !== "function") {
      throw new Error("Callback must be a function");
    } else {
      this.onClickCallbacks.leafletMarker = callback;
    }
  }

  /**
   * Register a callback function on timeline item click event.
   *
   * @param {function(x: MouseEvent): *} callback Function that will be
   *   provided click event details of some timeline item.
   */
  onTimelineItemClick(callback) {
    if (typeof callback !== "function") {
      throw new Error("Callback must be a function");
    } else {
      this.onClickCallbacks.timelineItem = callback;
    }
  }

  /**
   * When a Timeline `item` is double clicked, the Leaflet map will transition
   * the viewport to the sibling `Marker`. Since event delegation is being used
   * (the mouse down event capture occurs on the entire Timeline instance),
   * ensure that the `props` from the Timeline click event actually originates
   * from an `item` on the Timeline.
   *
   * @private
   * @see https://visjs.github.io/vis-timeline/docs/timeline/#getEventProperties
   */
  panMapToMarkerMatchingTimelineItem() {
    this.timeline.on("doubleClick", props => {
      if (props.what !== "item") {
        return; // ignore click events not originating from items on the Timeline
      }

      // match the Timeline `item` from the event with a Leaflet `marker`
      const timelineItem = { id: props.item, group: props.group }; // `item` from props is actually the `id` of the clicked upon item
      for (let [layerName, layerGroup] of this.leafletMarkerLayers.entries()) {
        const markers = layerGroup.getLayers();
        for (let marker of markers) {
          if (
            marker.options.id === timelineItem.id && // matching on both the id and the group/layer name
            layerName === timelineItem.group
          ) {
            this.flyToMarkerAndOpenPopup(marker);
            break; // escape early once matched
          }
        }
      }

      this.onClickCallbacks.timelineItem(props); // bubble event to subscriber
    });
  }

  /**
   * When a Leaflet marker is clicked, the Timeline will transition its
   * viewport and highlight the sibling Timeline item.
   *
   * @private
   * @param {L.FeatureGroup} overlayLayer
   */
  panTimelineToItemMatchingMapMarker(overlayLayer) {
    overlayLayer.on("click", event => { // using event delegation
      const { layer: { options: { id: markerId }}} = event;
      this.panToTimelineItemIfExists(markerId);

      // bubble event to subscriber
      this.onClickCallbacks.leafletMarker(event);
    });
  }

  /**
   * @public
   * @param {string} itemId
   */
  panToTimelineItemIfExists(itemId) {
    if (this.timelineItems.getIds().includes(itemId)) {
      this.timeline.setSelection(itemId, { focus: true });
    } else {
      console.warn(`A timeline item with id of \`${itemId}\` does not exist`);
    }
  }

  /**
   * @public
   * @param {string} itemId
   */
  panToTimelineItem(itemId) {
    this.timeline.setSelection(itemId, { focus: true });
  }

  /**
   * A method intended to be used by api consumers to manually pan the map and
   * the timeline to a common data item.
   *
   * @public
   * @param {number|string} id
   */
  panMapAndTimelineByItemId(id) {
    const searchDetails = {
      leaflet: { isFound: false },
      timeline: { isFound: false }
    };

    // search for the id in map markers
    this.leafletMarkerLayers.forEach((layer, name) => {
      for (let marker of layer.getLayers()) {
        if (marker.options.id === id) {
          searchDetails.leaflet = { marker, isFound: true };
          break;
        }
      }
    });

    // search for the id in the Timeline dataset
    if (this.timelineItems.getIds().includes(id)) {
      searchDetails.timeline.isFound = true;
    }

    // center Leaflet and Timeline if supplied id is matched to both a Timeline
    // item and a Leaflet marker
    if (searchDetails.leaflet.isFound && searchDetails.timeline.isFound) {
      this.flyToMarkerAndOpenPopup(searchDetails.leaflet.marker);
      this.panToTimelineItem(id);
    } else if (searchDetails.timeline.isFound === false) {
      throw new Error(
        `A Timeline item matching supplied unique id ${id} could not be found`
      );
    } else if (searchDetails.leaflet.isFound === false) {
      throw new Error(
        `A map marker matching supplied unique id ${id} could not be found`
      );
    } else {
      throw new Error(
        `Neither a map marker nor a Timeline item matching supplied unique id ${id} could not be found`
      );
    }
  }

  /**
   * @public
   * @param {Object[]} dataset A 1-d array of data objects used to create the
   *   markers and timeline items.
   *
   * @param {string} groupName An identifier used to group and organize similar
   *   markers and Timeline items.
   *
   * @param {function(x: Object): CreatedMarkerPropertiesType} createMarkerProperties
   *    A callback function that takes an object from `dataset` and returns
   *    another object of with the expected type.
   *
   * @param {function(x: Object): CreatedTimelineItemType} createTimelineItem
   *   A callback function that takes an item of `dataset` and returns the
   *   expected object type.
   *
   *   Note that it is the user's responsibility to provide values for `start`
   *   and `end` that comply with the `type` of Timeline item.
   *
   *   For example, `box` and `point` only require the `start` date whereas
   *   both the `start` and `end` properties are required for timeline items of
   *   type `range`.
   *
   * @param {Function} [markerPopupRenderer] A callback function that will be
   *   provided the current datum of `dataset` and is expected to return an
   *   html string.
   *
   * @return {void}
   *
   * @see https://leafletjs.com/examples/layers-control/
   * @see https://visjs.github.io/vis-timeline/docs/timeline/#items
   */
  populate(
    dataset,
    groupName,
    createMarkerProperties,
    createTimelineItem,
    markerPopupRenderer
  ) {
    if (!Array.isArray(dataset)) {
      throw new Error("The `dataset` must be a 1-d array of objects.");
    }

    this.addMarkerLayerGroup(groupName);
    this.addTimelineLayer(groupName);

    // add data
    for (let datasetItem of dataset.values()) {
      const targetLayer = this.leafletMarkerLayers.get(groupName);

      this.addMarker(
        datasetItem,
        targetLayer,
        createMarkerProperties(datasetItem),
        markerPopupRenderer
      );

      this.addTimelineItem(
        createTimelineItem(datasetItem)
      );
    }

    this.fit();
    this.setBehaviour(groupName);
  }

  /**
   * @public
   * @param {Object} datasetItem The data object used to create the marker and
   *   the timeline item.
   *
   * @param {string} groupName An identifier used to group and organize similar
   *   markers and Timeline items.
   *
   * @param {function(x: Object): CreatedMarkerPropertiesType} createMarkerProperties
   *    A callback function that takes an object from `dataset` and returns
   *    another object of with the expected type.
   *
   * @param {function(x: Object): CreatedTimelineItemType} createTimelineItem
   *   A callback function that takes an item of `dataset` and returns the
   *   expected object type.
   *
   *   Note that it is the user's responsibility to provide values for `start`
   *   and `end` that comply with the `type` of Timeline item.
   *
   *   For example, `box` and `point` only require the `start` date whereas
   *   both the `start` and `end` properties are required for timeline items of
   *   type `range`.
   *
   * @param {Function} [markerPopupRenderer] A callback function that will be
   *   provided the current datum of `dataset` and is expected to return an
   *   html string.
   *
   * @return {void}
   *
   *
   * @see https://leafletjs.com/examples/layers-control/
   * @see https://visjs.github.io/vis-timeline/docs/timeline/#items
   */
  populateSingle(
    datasetItem,
    groupName,
    createMarkerProperties,
    createTimelineItem,
    markerPopupRenderer
  ) {
    if (!this.leafletMarkerLayers.has(groupName)) {
      this.addMarkerLayerGroup(groupName);
    }

    if (!this.timelineGroups.get(groupName)) {
      this.addTimelineLayer(groupName);
    }

    const targetLayer = this.leafletMarkerLayers.get(groupName);

    this.addMarker(
      datasetItem,
      targetLayer,
      createMarkerProperties(datasetItem),
      markerPopupRenderer
    );

    this.addTimelineItem(
      createTimelineItem(datasetItem)
    );

    this.fit();
    this.setBehaviour(groupName);
  }

  /**
   * The user must handle the creation of the leaflet marker on their own. The
   * intended use case is for users that want to use an external leaflet marker
   * library or otherwise want to fully control how the marker is created.
   *
   * @public
   * @param {Object[]} dataset A 1-d array of data objects.
   *
   * @param {string} groupName An identifier used to group and organize similar
   *   markers and Timeline items.
   *
   * @param {function(x: Object): L.marker} createMarker A callback function
   *   that takes an object from `dataset` and returns a leaflet marker.
   *
   * @param {function(x: Object): CreatedTimelineItemType} createTimelineItem
   *   A callback function that takes an item of `dataset` and returns the
   *   expected object type.
   *
   *   Note that it is the user's responsibility to provide values for `start`
   *   and `end` that comply with the `type` of Timeline item.
   *
   *   For example, `box` and `point` only require the `start` date whereas
   *   both the `start` and `end` properties are required for timeline items of
   *   type `range`.
   *
   * @return {void}
   *
   * @see https://leafletjs.com/examples/layers-control/
   * @see https://visjs.github.io/vis-timeline/docs/timeline/#items
   */
  populateWithCustomMarker(
    dataset,
    groupName,
    createMarker,
    createTimelineItem
  ) {
    if (!Array.isArray(dataset)) {
      throw new Error("The `dataset` must be a 1-d array of objects.");
    }

    for (let datasetValue of dataset.values()) {
      this.populateWithCustomMarkerSingle(
        datasetValue,
        groupName,
        createMarker,
        createTimelineItem
      );
    }
  }

  /**
   * @param {Object} data
   * @param {string} groupName
   * @param {function(x: Object): L.marker} createMarker A callback function
   *   that takes an object and returns a leaflet marker.
   * @param {function(x: Object): CreatedTimelineItemType} createTimelineItem
   *   A callback function that takes an object and returns the expected type.
   */
  populateWithCustomMarkerSingle(
    data,
    groupName,
    createMarker,
    createTimelineItem
  ) {
    if (!this.leafletMarkerLayers.has(groupName)) {
      this.addMarkerLayerGroup(groupName);
    }

    if (!this.timelineGroups.get(groupName)) {
      this.addTimelineLayer(groupName);
    }

    const marker = createMarker(data);
    marker.addTo(this.leafletMarkerLayers.get(groupName))

    this.addTimelineItem(createTimelineItem(data));

    this.fit();
    this.setBehaviour(groupName);
  }

  /**
   * Create and add a new Leaflet FeatureGroup layer.
   *
   * @private
   * @param {string} name
   * @return {L.FeatureGroup}
   * @throws {Error} When the layer already exists.
   */
  addMarkerLayerGroup(name) {
    if (this.leafletMarkerLayers.has(name)) {
      throw new Error(`Map layer \`${name}\` already exists`);
    }

    this.addLayerControlOnce();
    this.leafletMarkerLayers.set(name, new L.FeatureGroup());
    const layer = this.leafletMarkerLayers.get(name);
    this.leafletControlLayer.addOverlay(layer, name);
    this.map.addLayer(layer);

    return layer;
  }

  /**
   * Create and add a new Timeline group layer.
   *
   * @private
   * @param {string} name
   * @return {FullItem}
   * @throws {Error} When the group layer already exists.
   */
  addTimelineLayer(name) {
    if (!!this.timelineGroups.get(name)) {
      throw new Error(`Timeline layer group \`${name}\` already exists`);
    } else {
      this.timelineGroups.add({ id: name, content: name });
      return this.timelineGroups.get(name);
    }
  }

  /**
   * @private
   * @param {Object} data
   * @param {L.FeatureGroup} targetLayer
   * @param {CreatedMarkerPropertiesType} markerProperties
   * @param {Function} [markerPopupRenderer]
   */
  addMarker(data, targetLayer, markerProperties, markerPopupRenderer) {
    const { id, longitude: lng, latitude: lat } = markerProperties;
    const marker = new L.marker([lat, lng], { id }).on("click", e => {
      this.onClickCallbacks.leafletMarker &&
      this.onClickCallbacks.leafletMarker(e);
    });

    if (markerPopupRenderer) {
      marker.bindPopup(markerPopupRenderer(data));
    }

    marker.addTo(targetLayer);
  }

  /**
   * @private
   * @param {CreatedTimelineItemType} item
   */
  addTimelineItem(item) {
    this.timelineItems.add(item);
  }

  /**
   * @private
   */
  setBehaviour(groupName) {
    const markerLayerGroup = this.leafletMarkerLayers.get(groupName);

    this.panMapToMarkerMatchingTimelineItem();
    this.panTimelineToItemMatchingMapMarker(markerLayerGroup);
    this.syncTimelineGroupsVisibilityWithLeafletControlOverlay();
  }

  /**
   * @public
   */
  fit() {
    this.fitTimeline();
    this.fitMap();
  }

  /**
   * @public
   */
  fitTimeline() {
    this.timeline.fit();
  }

  /**
   * Fits map viewport to show all markers from all layers.
   *
   * @public
   */
  fitMap() {
    const markers = [];
    for (let layer of this.leafletMarkerLayers.values()) {
      markers.push(...layer.getLayers());
    }
    const featureGroup = new L.featureGroup(markers);
    const bounds = featureGroup.getBounds().pad(0.05); // pad prevents viewport from cutting off markers on the edges
    this.map.fitBounds(bounds);
  }

  /**
   * Syncs visibility of Timeline groups to match the display toggle of overlay
   * layers in the `L.control.layers` instance.
   *
   * This is accomplished by adding event listeners to each checkbox
   * corresponding to overlays attached to the `L.control.layers` instance.
   *
   * @private
   */
  syncTimelineGroupsVisibilityWithLeafletControlOverlay() {
    const checkboxes = this.retrieveCheckboxesForLeafletControlLayerOverlays();
    checkboxes.forEach((checkbox, overlayName) => {
      checkbox.addEventListener("change", event => {
        this.handleVisibilityOfTimelineGroups(
          overlayName,
          event.target.checked
        );
      });
    });
  }

  /**
   * Logic that synchronizes the display status of overlays in the Leaflet
   * `L.Control.Layers` class with the Timeline's groups such that when an
   * overlay is toggled off, the corresponding Timeline group is also hidden.
   *
   * @private
   * @param {string} overlayName The name of the Leaflet `L.control.Layers`
   *   overlay that the checkbox controls.
   * @param {boolean} isChecked The `checked` property on the the `change` event
   *   listener attached to checkboxes in the `L.control.layers` class.
   */
  handleVisibilityOfTimelineGroups(overlayName, isChecked) {
    if (typeof isChecked !== "boolean") {
      console.warn("`isChecked must be of type boolean");
    }

    this.timelineGroups.forEach(group => {
      if (group.id === overlayName) {
        this.timelineGroups.update({
          id: group.id,
          visible: isChecked
        });

        this.fitTimeline();
      }
    });
  }

  /**
   * Extracts a Map of all input checkboxes corresponding to overlays attached
   * to the `L.control.layers` factory in Leaflet.
   *
   * @private
   * @returns {Map} Will contain a <K,V> pair wherein `K` is the name of the
   *   input as denoted by the sibling span tag and `V` is the checkbox input
   *   element itself.
   */
  retrieveCheckboxesForLeafletControlLayerOverlays() {
    const checkboxes = new Map();
    const overlayHtmlElements = this.leafletControlLayer._overlaysList.children;
    for (let el of overlayHtmlElements) {
      if (el.control.type === "checkbox" && el.control.labels.length === 1) {
        const span = el.control.nextSibling;
        const checkboxName = span.textContent.trim();
        checkboxes.set(checkboxName, el.control);
      }
    }

    return checkboxes;
  }

  /**
   * @private
   * @param {L.Marker} marker
   */
  flyToMarkerAndOpenPopup(marker) {
    this.flyToMarker(marker);
    this.openMarkerPopup(marker);
  }

  /**
   * @private
   * @param {L.Marker} marker
   */
  flyToMarker(marker) {
    this.map.flyTo(marker.getLatLng());
  }

  /**
   * @private
   * @param {L.Marker} marker
   */
  openMarkerPopup(marker) {
    marker.openPopup();
  }

  /**
   * @public
   */
  scrollTimelineToBottom() {
    const timelineVerticalScroll = this.timeline.dom.leftContainer;
    timelineVerticalScroll.scrollTop = timelineVerticalScroll.scrollHeight;
  }

  /**
   * @public
   */
  clearMapAndTimeline() {
    this.clearMap();
    this.clearTimeline();
  }

  /**
   * Clears all existing Leaflet LayerGroups including their markers as well as
   * removing the LayerGroup from the Layer Control and the Leaflet Map
   * instance.
   *
   * @public
   */
  clearMap() {
    this.leafletMarkerLayers.forEach((layer, layerName) => {
      layer.clearLayers(); // clear Leaflet Markers
      this.leafletControlLayer.removeLayer(layer); // remove `L.LayerGroup` from Leaflet Control
      this.map.removeLayer(layer); // remove `L.LayerGroup` from Leaflet Map
      this.leafletMarkerLayers.delete(layerName); // delete `L.LayerGroup` instance from internal Map()
    });
  }

  /**
   * @public
   */
  clearTimeline() {
    this.timelineGroups.clear();
    this.timelineItems.clear();
    this.timeline.off("doubleClick"); // remove double click handler
  }

  /**
   * Determines whether or not a marker exists within the grouping layers.
   *
   * @public
   * @param {string} id
   * @return {boolean}
   */
  doesMapMarkerExist(id) {
    for (let markerLayer of this.leafletMarkerLayers.values()) {
      for (let marker of markerLayer.getLayers()) {
        if (marker.options.id === id) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Determines whether or not an item exists in the Timeline.
   *
   * @public
   * @param {string} id
   * @return {boolean}
   */
  doesTimelineItemExist(id) {
    return this.timelineItems.getIds().includes(id);
  }

  /**
   * @private
   * @param {string} id
   * @return {[L.marker, L.featureGroup]}
   * @throws {Error} When the requested marker could not be found.
   */
  getMarkerLayer(id) {
    for (let markerLayer of this.leafletMarkerLayers.values()) {
      for (let marker of markerLayer.getLayers()) {
        if (marker.options.id === id) {
          return [marker, markerLayer];
        }
      }
    }

    throw new Error(`Could not find marker with id: ${id}`);
  }

  /**
   * @public
   * @param {string} id
   */
  removeItemById(id) {
    if (!this.doesMapMarkerExist(id) && !this.doesTimelineItemExist(id)) {
      throw new Error(
        `Cannot remove item with id ${id} because it has not been added`
      );
    }

    this.removeMapMarkerById(id);
    this.removeTimelineItemById(id);
  }

  /**
   * Removes an entire group at once.
   *
   * @public
   * @param {string} group
   */
  removeGroup(group) {
    if (
      !this.timelineGroups.get(group) &&
      !this.leafletMarkerLayers.has(group)
    ) {
      throw new Error(`\`${group}\` group does not exist`);
    }

    this.timelineGroups.remove(group);
    this.map.removeLayer(this.leafletMarkerLayers.get(group));
    this.leafletMarkerLayers.delete(group); // remove local reference
  }

  /**
   * @private
   * @param {string} id
   */
  removeMapMarkerById(id) {
    const [marker, markerLayer] = this.getMarkerLayer(id);
    markerLayer.removeLayer(marker);
  }

  /**
   * @private
   * @param {string} id
   */
  removeTimelineItemById(id) {
    this.timelineItems.remove(id);
  }

  /**
   * Cleans up the Leaflet and Timeline instances as well as the associated
   * event listeners.
   *
   * @public
   */
  destroy() {
    this.map.remove();
    this.map.clearAllEventListeners();
    this.timeline.destroy();
  }

  /**
   * @public
   * @param item
   */
  updateItem(item) {}
}

export { Chronomap };

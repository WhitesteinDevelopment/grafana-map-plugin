import WorldMap from './worldmap';
import { hideAll } from './utils/map_utils';

export default function link(scope, elem, attrs, ctrl) {
  const mapContainer = elem.find('.map-container');

  ctrl.events.on('render', () => {
    render();
    ctrl.renderingCompleted();
  });

  function render() {
    if (!ctrl.data) return;

    if (!ctrl.worldMap) {
      ctrl.worldMap = new WorldMap(ctrl, mapContainer[0]);
    }

    hideAll();
    ctrl.worldMap.resize();

    //if (ctrl.mapCenterMoved) 
    ctrl.worldMap.panToMapCenter();

    ctrl.worldMap.clearCircles();

    //for each target drawpoints  
    // ctrl.panel.targets.forEach((target)=>{
    //   console.log('processing target '+target.datasource)
    ctrl.worldMap.setPollutants()
    //   ctrl.worldMap.drawPoints(target);
    // })

    ctrl.worldMap.drawPoints();

  }
}

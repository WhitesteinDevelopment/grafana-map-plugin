// draw components in the map
/* Vendor specific */
import _ from 'lodash';

/* Grafana Specific */
import config from 'app/core/config';

/* App specific */
import { AQI, CARS_COUNT, HIGHCHARTS_THEME_DARK, NOMINATIM_ADDRESS } from '../definitions';

/**
* Primary functions
*/

//helper to create series for chart display
function getTimeSeries(data) {
  const valueValues = {};
  const values = [];
  const pollutantsValues = [];

  Object.keys(data).forEach((key) => {
    data[key].forEach((point) => {
      const id = point.id;
      const time = point.time;
      let pollutants = '';

      const value = point.value;
      if (point.type === 'AirQualityObserved') {
        pollutants = point.pollutants;
        const pollutantsTemp = {};

        pollutants.forEach((pollutant) => {
          if (!(pollutantsValues[pollutant.name])) {
            pollutantsValues[pollutant.name] = [];
          }
          pollutantsValues[pollutant.name].push({'time': time, 'value': pollutant.value, 'id': id});
        });
      }

      if (!(valueValues[point.id])) {
        valueValues[point.id] = [];
      }
      valueValues[point.id].push({'time': time, 'value': value, 'id': id});
    });
  });

  return {'values': valueValues, 'pollutants': pollutantsValues};
}

// Agregate data by id
function dataTreatment(data) {
  const finalData = {};
  let auxData;

  data.forEach((value) => {
    if (!(finalData[value.id])) {
      finalData[value.id] = [];
    }

    auxData = {
        'id': value.id, 
        'locationLatitude': value.locationLatitude, 
        'locationLongitude': value.locationLongitude, 
        'time': value.time, 
        'type': value.type, 
        'value': value.value
      }

    if (value.type === 'AirQualityObserved')
      auxData.pollutants = value.pollutants;

    finalData[value.id].push( auxData );
  });

  return finalData;
}

function getUpdatedChartSeries(chartSeries, timeSeries, currentTargetForChart, currentParameterForChart) {

  if(Object.keys(chartSeries).length === 0)
    return chartSeries

  const targetType = currentTargetForChart.target.options.type;
  const targetId = currentTargetForChart.target.options.id;
  const currentParameter = currentParameterForChart.toLowerCase();
  let lastMeasure;
  let lastTime;

  try {
    let timeTemp;
    if (currentParameter !== 'aqi' && targetType === 'AirQualityObserved'){
      timeTemp = timeSeries.pollutants[currentParameter];
      timeTemp.forEach((val) => {
        if (val.id === targetId){
          lastTime = val.time;
          lastMeasure = val.value;
        } 
      });
    } else {
      timeTemp = timeSeries.values[targetId];
      lastMeasure = timeTemp[timeTemp.length - 1].value;
      lastTime = timeTemp[timeTemp.length - 1].time
    }
   
    const time = new Date(lastTime);
    const day = time.getDate();
    const month = time.getMonth();
    const year = time.getFullYear();
    const hour = time.getHours() - 1;
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();
    const milliseconds = time.getMilliseconds();      
    const chartLastDisplayedValue = chartSeries.data[chartSeries.data.length - 1].y;
    const chartLastDisplayedTime = chartSeries.data[chartSeries.data.length - 1].x;
    let chartLastDisplayedId = chartSeries.name.split(' ');

    chartLastDisplayedId = parseInt(chartLastDisplayedId[chartLastDisplayedId.length - 1]);      

    if (!(lastTime === chartLastDisplayedTime && lastMeasure === chartLastDisplayedValue && targetId === chartLastDisplayedId)){
      chartSeries.addPoint([Date.UTC(year, month, day, hour+1, minutes, seconds, milliseconds), lastMeasure], true, true);
    }
  } catch(error){
    console.log("Error:");
    console.log(error);
  }

  return chartSeries;
}

function processData(chartSeries, timeSeries, validated_pollutants, currentParameterForChart, currentTargetForChart) {
  let chartData = [];
  const currentParameter = currentParameterForChart.toLowerCase();
  const id = currentTargetForChart.target.options.id;
  const type = currentTargetForChart.target.options.type;
  const values = timeSeries.values[id];

  let parameterUnit = '';
  let title = '';

  if (type === 'AirQualityObserved' && currentParameter !== 'aqi') {
    parameterUnit = validated_pollutants[currentParameter].unit;
    title = validated_pollutants[currentParameter].name + ' - Device ' + id;

    const parameterChoice = timeSeries.pollutants[currentParameter];      
    parameterChoice.forEach((sensor) => {
      if (sensor.id === id) {
       chartData.push(createLine(sensor));
      }
    });
  } else {
    if(type === 'TrafficFlowObserved') {
      title = 'Cars Intensity - Device ' + id;
      parameterUnit = 'Cars'
    } else {
      title = type + ' - Device ' + id;
      parameterUnit = type;
    }

    values && values.forEach((value) => {
      chartData.push(createLine(value));
    });
  }

  return [chartData, parameterUnit, title]
}



/*
* Auxiliar functions
*/
// just for improve DRY
function createLine(value) {
  const time = new Date(value.time);
  const day = time.getDate();
  const month = time.getMonth();
  const year = time.getFullYear();
  const hour = time.getHours() - 1;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const milliseconds = time.getMilliseconds();
  return [Date.UTC(year, month, day, hour+1, minutes, seconds, milliseconds), value.value]
}

// Access remote api and gives the coordinates from a city center based on NOMINATIM url server
function getCityCoordinates(city_name) {
  let url = NOMINATIM_ADDRESS.replace('<city_name>', city_name)
  return fetch(url)
    .then(response => response.json())
    .then(data => { return { latitude: data[0].lat, longitude: data[0].lon } })
    .catch(error => console.error(error))
}

// Given vars passed as param, retrieves the selected city
function getSelectedCity(vars) {
  let cityenv_ = vars.filter(elem => elem.name==="cityenv")
  let city = null;
  if(cityenv_ && cityenv_.length === 1)
    city = cityenv_[0].current.value

  return city;
}

// gets the aqi index from the AQI var
function calculateAQIIndex(value) {
  let aqiIndex;
  AQI.range.forEach((elem, index) => {
    if (value >= elem) {
      aqiIndex = index;
    }
  });
  return aqiIndex;
}
// gets the index from the CARS_COUNT const var
function calculateCarsIntensityIndex(value) {
  CARS_COUNT.range.forEach((elem, index) => {
    if (value >= elem) {
      return index;
    }
  });
  return 0;
}


/*
* View components controllers
*/
function drawPopups(panel_id, timeSeries, validated_pollutants, currentParameterForChart, currentTargetForChart) {
  if(!currentTargetForChart)
    return ;

  //console.log('drawPopups');
  const selected_id = currentTargetForChart.target.options.id;
  const type = currentTargetForChart.target.options.type;
  const values = timeSeries.values[selected_id];

  hideAllGraphPopups(panel_id)

  //render popups
  try {
    const lastValueMeasure = values[values.length - 1].value; //values array is the one for the AQI values
    const aqiIndex = calculateAQIIndex(lastValueMeasure);

    // Show Pollutants Legend (MAP)

    switch(type) {
      case 'AirQualityObserved':
        const allPollutants = timeSeries.pollutants;

        if(validated_pollutants) {
          drawPollutantsPopup(panel_id, validated_pollutants, allPollutants, selected_id, lastValueMeasure, currentParameterForChart);
          drawHealthConcernsPopup(panel_id, validated_pollutants, AQI.risks[aqiIndex], AQI.color[aqiIndex], AQI.meaning[aqiIndex]);
        }
        break;
      case 'TrafficFlowObserved':
        drawTrafficFlowPopup(panel_id);
        break;
      default:
        drawDefaultPopups(panel_id);
    }
    
  } catch(error) {
    console.log("Error:");
//    console.log(error);
    console.log("selected_id: " + selected_id + ", type: " + type + ", values: " + values)
  }
}



/*
* view components manipulation
*/
function showDataDetailsSelect(panel_id) {
  document.querySelector('#data_details_'+panel_id).style.display = 'block';
}

function getDataPointValues(dataPoint) {

  const values = {
    id: dataPoint.id,
    type: dataPoint.type,
    latitude: dataPoint.locationLatitude,
    longitude: dataPoint.locationLongitude,
    value: dataPoint.value,
    fillOpacity: 0.5
  }

  if(dataPoint.type==='AirQualityObserved') {
    const aqi = calculateAQIIndex(dataPoint.value);
    const aqiColor = AQI.color[aqi];
    const aqiMeaning = AQI.meaning[aqi];
    const aqiRisk = AQI.risks[aqi];

    const pollutants = dataPoint.pollutants;
    if(pollutants) {
      pollutants.push({'name': 'aqi', 'value': dataPoint.value});
    }

    _.defaults(values, {
      color: aqiColor,
      fillColor: aqiColor,
      aqiColor: aqiColor,
      aqiMeaning: aqiMeaning,
      aqiRisk: aqiRisk,
      pollutants: pollutants,
      aqi: dataPoint.value
    })    
  } else {
    if(dataPoint.type==='TrafficFlowObserved') {
      let color_index = calculateCarsIntensityIndex(dataPoint.value)
      _.defaults(values, {
        color: CARS_COUNT.color[color_index],
        fillColor: CARS_COUNT[color_index]
      })
    }
  }

  return values;
}

function getDataPointStickyInfo(data) {
  let stickyInfo = '<div class="stycky-popup-info">'

  if(data.type==='AirQualityObserved') {
    stickyInfo += '<div class="head air-quality">Air Quality</div>' +
      '<div class="body">'+
        '<div>Device: ' + data.id + '</div>' +
        '<div>AQI: ' + data.value + ' (' + data.aqiMeaning + ')</div>'+
      '</div>'

  } else {
    if(data.type==='TrafficFlowObserved') {
      stickyInfo += '<div class="head traffic-flow">Cars Intensity</div>'
    } else {
      stickyInfo += '<div class="head">' + data.type + '</div>'
    }

    stickyInfo += '<div class="body">'+
      '<div>Device: ' + data.id + '</div>' +
      '<div>Value: '+data.value + '</div>' +
    '</div>'
  }
  stickyInfo += '</div>'

  return stickyInfo
}


function renderChart(panel_id, chartSeries, chartData, parameterUnit, title) {

  showDataDetailsSelect(panel_id);
  drawChart(panel_id);

  //config highchart acording with grafana theme
  if(!config.bootData.user.lightTheme)
    window.Highcharts.setOptions(HIGHCHARTS_THEME_DARK);

  window.Highcharts.stockChart('graph_container_'+panel_id, 
    {
      chart: {
        height: 200,
        zoomType: 'x',
        events: {
          load: function () {            
            chartSeries = this.series[0]; // set up the updating of the chart each second
          }
        }
      },
      title: {
          text: title
      },
      subtitle: {
          text: ''
      },
      xAxis: {
          type: 'datetime'
      },
      yAxis: {
          title: {
              text: parameterUnit
          }
      },
      legend: {
          enabled: false
      },
      rangeSelector: {
        buttons: [{
            count: 5,
            type: 'minute',
            text: '5M'
        }, {
            count: 10,
            type: 'minute',
            text: '10M'
        }, {
            type: 'all',
            text: 'All'
        }],
        inputEnabled: false,
        selected: 2
      },

      series: [{
          name: title,
          data: chartData
      }]
    }
  );
}
function hideAllGraphPopups(panel_id) {
  let map_table_popups = ['measures_table', 'health_concerns_wrapper', 'environment_table', 'traffic_table'];

  for(let map_table_popup of map_table_popups) {
    let popup = document.getElementById(map_table_popup+'_'+panel_id)
    if(popup)
      popup.style.display = 'none';
  }
}
function drawHealthConcernsPopup(panel_id, providedPollutants, risk, color, meaning, map_size) {
  const healthConcernsWrapper = document.getElementById('health_concerns_wrapper_'+panel_id);
  const healthConcerns = document.querySelector('#health_concerns_wrapper_'+panel_id+'>div');
  const healthConcernsColor = document.querySelector('#health_concerns_wrapper_'+panel_id+'>div>span>span.color');
  const healthRisk = document.getElementById('health_risk_'+panel_id);

  healthConcernsWrapper.style.display = 'block';
  healthConcernsColor.style.backgroundColor = color;
  healthRisk.innerHTML = risk;
}
function drawDefaultPopups() {  
}
function drawTrafficFlowPopup(panel_id) {
  document.getElementById('traffic_table_'+panel_id).style.display = 'block';
}
function drawChart(panel_id) {
  document.getElementById('data_chart_'+panel_id).style.display = 'block';
}
function drawPollutantsPopup(panel_id, providedPollutants, allPollutants, id, aqi, currentParameterForChart) {

  //no pollutants
  if(!providedPollutants || Object.keys(providedPollutants).length===0)
    return ;

  const measuresTable = document.querySelector('#measures_table_'+panel_id+' > table > tbody');
  while (measuresTable.rows[0]) measuresTable.deleteRow(0);

  // Remove air paramters from dropdown
  var el = document.querySelector('#air_parameters_dropdown_'+panel_id);
  while ( el.firstChild ) {
    el.removeChild( el.firstChild )
  }

  const pollutantsToShow = {};
  for (const key in allPollutants) {    
    allPollutants[key].forEach((_value) => {
      if (_value.id === id) {
        if (_value.value) {
          if (!(pollutantsToShow[key])){
            pollutantsToShow[key] = 0;
          }
          pollutantsToShow[key] = _value.value;
        }
      }
    });
  }

  pollutantsToShow['aqi'] = aqi;

  for (const pollutant in pollutantsToShow){
    const row = measuresTable.insertRow(0);
    const innerCell0 = providedPollutants[pollutant].name;
    const innerCell1 = pollutantsToShow[pollutant] + ' ' + providedPollutants[pollutant].unit;
    const cell0 = row.insertCell(0);
    const cell1 = row.insertCell(1);

    cell0.innerHTML = innerCell0;
    cell1.innerHTML = innerCell1;

    // Add Pollutants to Chart Dropdown
    const newPollutant = document.createElement('option');
    newPollutant.id = 'pollutantOption';
    newPollutant.value = pollutant.toUpperCase();

    if(currentParameterForChart===newPollutant.value)
      newPollutant.selected = 'selected';
    
    newPollutant.innerHTML = providedPollutants[pollutant].name;

    el.appendChild(newPollutant);
    // ----
  }

  document.getElementById('environment_table_'+panel_id).style.display = 'block';
  document.getElementById('measures_table_'+panel_id).style.display = 'block';
}

export {
  processData,
  getTimeSeries, 
  dataTreatment, 
  getUpdatedChartSeries, 

  hideAllGraphPopups, 
  drawPopups,
  renderChart,

  getCityCoordinates,

  getDataPointValues,
  getDataPointStickyInfo,

  getSelectedCity
}
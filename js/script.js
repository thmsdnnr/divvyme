let G = {};
G.defaultPos={lat: 41.881832, lng: -87.623177};

function alertDisplay(msg) {
  let msgBox=document.querySelector('div#message');
  msgBox.style.display='block';
  let mType;
  switch (msg.type) {
    case 'success': mType='alert-success'; break;
    case 'info': mType='alert-info'; break;
    case 'warning': mType='alert-warning'; break;
    case 'danger': mType='alert-danger'; break;
    default: mType='alert-success'; break;
  }
  msgBox.innerHTML=`
    <div class='col-sm-8 col-sm-offset-2'>
      <div class='alert ${mType}' role='alert' id='messageText'>
      <strong>${msg.title}</strong> ${msg.body}
    </div>
  </div>`;
}

//from lodash
function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

function handleAddressSubmission(e) {
  e.preventDefault();
  addressToLatLon(document.querySelector('input#address').value).then((loc)=>{
    initMap({lat:loc.lat(), lng:loc.lng()})
  }).catch((err)=>{
    initMap(G.defaultPos);
  });
}

const handleResize = debounce(()=>{
    if (!G.map) { return false; }
    google.maps.event.trigger(G.map, 'resize');
    G.directionsEnd ?  G.map.panTo(G.directionsEnd) : G.map.panTo(G.myLoc);
  },50);

function addEventListeners() {
    window.addEventListener('resize', handleResize);
    document.getElementById('submit').addEventListener('click', handleAddressSubmission);
    document.querySelector('form#addressSearch').addEventListener('submit', handleAddressSubmission);
}

function generateLabel(numBikes) {
  let fillColor, textColor;
  let width=42;
  let height=42;
  let xTrans=16;
  let yTrans=14;
  if (numBikes>=8) { fillColor="00FF00"; textColor="000000"; }
  else if (numBikes<8 && numBikes>=3) {fillColor="FFEA00"; }
  else if (numBikes<3 && numBikes>0) {fillColor="FF0000"; textColor="FFFFFF"; }
  else { return 0; }
  var pre=`data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22${width}%22%20
  height%3D%22${height}%22%20viewBox%3D%220%200%20${width}%20${height}%22%3E%3Cpath%20fill%3D%22%23${fillColor}%22%20stroke%3D%22%2300
  0%22%20stroke-width%3D%22.5%22%20d%3D%22M 15.786613,31.870243 13.601938,20.482879 0.94669915,6.8964466 c 5.38688795,-7.02486081 25.06615785,-7.20362 30.28337885,0.125 L 18.198544,20.591246 Z
  %22%2F%3E%3Ctext%20
  transform%3D%22translate%28${xTrans}%20${yTrans}%29%22%20fill%3D%22%23${textColor}%22%20style%3D%22font-family%3A%20Courier%2C%20sans-serif
  %3Bfont-weight%3Abold%3Btext-align%3Acenter%3B%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%3E`;
  var post='%3C%2Ftext%3E%3C%2Fsvg%3E';
  return pre+numBikes+post;
}

function generateMapAndPlotStations() {
  updatePageText();
  let S=G.stations.stationBeanList;
  let distances=[];
  let loader=document.getElementById('loader');
  if (loader) { loader.style.display='none'; }
  G.map = new google.maps.Map(document.getElementById('map'), {zoom: 14, center: G.myLoc, styles:mapStyles});
  new google.maps.BicyclingLayer().setMap(G.map);
  S.filter(e=>(e.is_renting&&e.status==="IN_SERVICE"&&!e.testStation&&e.availableBikes>0))
  .forEach(s=>{
    let distance=haversine({lat:G.myLoc.lat, lon:G.myLoc.lng},{lat: s.latitude, lon: s.longitude});
    distances.push({station:s, distance:distance});
  });
  G.closeToMe=distances.sort((a,b)=>a.distance-b.distance).slice(0,25); //max of 25 per query
  closeToMeLatLon=G.closeToMe.map(e=>new google.maps.LatLng(e.station.latitude, e.station.longitude));
  var service = new google.maps.DistanceMatrixService();
  service.getDistanceMatrix({
    origins: [new google.maps.LatLng(G.myLoc.lat, G.myLoc.lng)],
    destinations: closeToMeLatLon,
    travelMode: 'WALKING',
    unitSystem: google.maps.UnitSystem.IMPERIAL,
    avoidHighways: true
  }, distanceMatrixCallback);
}

function generateInfoWindow(S) {
  let sTN=S.data.station;
  let names=sTN.stationName.split('&').map(e=>e.trim().split(' ')[0]).join(' & ');
  let bikePlural = sTN.availableBikes>1 ? 'bikes' : 'bike';
  return `<div id="infoBox"><h1>${sTN.availableBikes} ${bikePlural}<br />
  <h2>${names}</h2></div><br />
  <h3>${S.data.gDist} | ${S.data.gDuration} walk</h3>`
}

function haversine(a, b) {
  let deltaLat=b.lat-a.lat;
  let deltaLon=b.lon-a.lon;
  let radius=6372.8; //km
  let hA = Math.pow(Math.sin(deltaLat/2),2)+(Math.cos(a.lat)*Math.cos(b.lat)*Math.pow(Math.sin(deltaLon/2),2));
  let c = 2*Math.asin(Math.min(1,Math.sqrt(hA)));
  return radius*c;
}

const degToRad = (deg) => deg*Math.PI/180;
const radToDeg = (rad) => 180*rad/Math.PI;

const fmtTime = (ms) => {
  seconds=ms/1000;
  let M = Math.floor(seconds/60);
  let S = Math.round(seconds-(M*60));
  M=(M>0) ? ((M<2) ? M+" minute" : M+" minutes") : "";
  S = M!=="" ? M+" and "+S+" seconds" : S+" seconds";
  return S;
}

function unmountDirections() {
  G.directionsEnd=null;
  G.directionsDisplay.setMap(null);
  G.directionsDisplay=null;
  let container=document.getElementById('dirPanelContainer');
  container.style.display='hidden';
  container.classList.remove('col-sm-4');
  let panel=document.getElementById('directionsPanel');
  panel.innerHTML='';
}

function initDirections(start, end) {
  if(G.directionsDisplay!==null) {
    G.directionsDisplay.setMap(null);
    G.directionsDisplay = null;
  }
  Object.assign(G,{
    directionsService:new google.maps.DirectionsService(),
    directionsDisplay:new google.maps.DirectionsRenderer(
      {preserveViewport: true, suppressMarkers: true})
    });
  G.directionsDisplay.setMap(G.map);
    var request = {
      origin: start,
      destination: end,
      travelMode: 'WALKING'
    };
  G.directionsEnd=end;
  G.map.panTo(G.directionsEnd);
    let dPanel=document.getElementById('dirPanelContainer');
    dPanel.style.display='inline';
    dPanel.classList.add('col-sm-4');
  G.directionsDisplay.setPanel(document.getElementById('directionsPanel'));
    G.directionsService.route(request, function(result, status) {
      if (status==='OK') {
        G.directionsDisplay.setDirections(result);
        return result.routes[0].distance;
      }
      else {
        alertDisplay({
          type:'warning',
          title:'Uh-oh!',
          body:'We were unable to directions from Google.'
        });
      }
    });
  }

function addressToLatLon(address) {
  return new Promise(function(resolve,reject) { //SW x NE corners of Chicago
    var city = new google.maps.LatLngBounds(new google.maps.LatLng(41.720081, -87.816811),new google.maps.LatLng(42.079623, -87.68755));
    geocoder = new google.maps.Geocoder();
    geocoder.geocode({address: address,bounds: city}, function(results, status) {
      if (status==='OK') { resolve(results[0].geometry.location); }
      else {
        alertDisplay({
        type:'warning',
        title:'Uh-oh!',
        body:'We were unable to find this location with Google.'
      });
      reject('Geocode was not successful for the following reason: ' + status);
    }
    });
  });
}

function updatePageText() {
  document.getElementById('currentAO').innerHTML=`data is ${fmtTime(Date.now()-Date.parse(G.stations.executionTime))} old`;
}

function getStations() {
  return new Promise(function(resolve,reject) {
    fetch('https://cors-anywhere.herokuapp.com/https://feeds.divvybikes.com/stations/stations.json',
    {method:'GET', type:'jsonp'}).then(r=>r.json()).then(d=>{
      resolve(d);
    });
  });
}

function distanceMatrixCallback(response, status) {
  if (status!=='OK') {
    alertDisplay({
      type:'warning',
      title:'Uh-oh!',
      body:'We were unable to fetch distance data from Google.'
    });
  }
  G.closeToMe.forEach((e,idx)=>{
    e.gDist=response.rows[0].elements[idx].distance.text;
    e.gDuration=response.rows[0].elements[idx].duration.text;
    let M=new google.maps.Marker({
         position: {lat: e.station.latitude, lng: e.station.longitude},
         icon: generateLabel(e.station.availableBikes),
         map: G.map,
         animation: google.maps.Animation.DROP
      });
    let infoWindow = new google.maps.InfoWindow({content: generateInfoWindow({data:e}), maxWidth: 170});
    infoWindow.addListener('closeclick', unmountDirections);
    M.addListener('click', function(e) {
      updatePageText();
      let mine=new google.maps.LatLng(G.myLoc.lat, G.myLoc.lng);
      G.infoWindows.map(e=>e.close()); //clear out old info
      document.getElementById('directionsPanel').innerHTML='';
      G.infoWindows.push(infoWindow); //re-initialize
      initDirections(G.myLoc, new google.maps.LatLng(M.position.lat(), M.position.lng()));
      infoWindow.open(map, M);
      });
    });
}

function getPositionFix() {  //get user's lat/lon; default to Downtown Chicago
  return new Promise(function(resolve,reject) {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(function(ME) {
        resolve({lat:ME.coords.latitude, lng:ME.coords.longitude});
      },
      function(err) { resolve(G.defaultPos); }
    );
  } else { resolve(G.defaultPos); }
  });
}

function initMap(location) {
  addEventListeners();
  Object.assign(G,{
    directionsService:new google.maps.DirectionsService(),
    directionsDisplay:new google.maps.DirectionsRenderer({preserveViewport: true, suppressMarkers: true})
  });
  let distances=[];
  G.infoWindows=[];
  if (!location&&!G.myLoc) {
    let geolocate=getPositionFix();
    let stations=getStations();
    Promise.all([geolocate,stations]).then((res)=>{
      G.myLoc=res[0];
      G.stations=res[1];
      generateMapAndPlotStations();
    }).catch((err)=>{
      alertDisplay({
        type:'warning',
        title:'Uh-oh!',
        body:'We were unable to fetch a list of divvy stations at this time.'
      });
  });
  } else if (G.stations) {
      G.myLoc=location;
      generateMapAndPlotStations();
    } else {
      getStations().then((s)=>{
        G.stations=s;
        generateMapAndPlotStations();
      }).catch((err)=>{
        alertDisplay({
          type:'warning',
          title:'Uh-oh!',
          body:'We were unable to fetch a list of divvy stations at this time.'
        });
      });
    }
}

const mapStyles=[
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ebe3cd"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#523735"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f1e6"
      }
    ]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#c9b2a6"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#dcd2be"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#ae9e90"
      }
    ]
  },
  {
    "featureType": "landscape.man_made",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "landscape.natural",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dfd2ae"
      }
    ]
  },
  {
    "featureType": "landscape.natural.terrain",
    "stylers": [
      {
        "color": "#ffeb3b"
      },
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dfd2ae"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#93817c"
      }
    ]
  },
  {
    "featureType": "poi.business",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#a5b076"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#447530"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f1e6"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#fdfcf8"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f8c967"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#e9bc62"
      }
    ]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e98d58"
      }
    ]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#db8555"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#806b63"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dfd2ae"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#8f7d77"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#ebe3cd"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dfd2ae"
      }
    ]
  },
  {
    "featureType": "transit.station.rail",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#b9d3c2"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#92998d"
      }
    ]
  }
];

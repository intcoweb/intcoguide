import os
import re

root = r"C:\Users\INTCO\Desktop\桂校导航\web-guide"
src = open(os.path.join(root, "index.html"), encoding="utf-8").read()

stub = """
  <style>#app{position:fixed;left:0;top:0;width:390px!important;max-width:390px!important;height:844px!important}</style>
  <script>
  (function () {
    var q = new URLSearchParams(location.search);
    var lat = parseFloat(q.get('lat'));
    var lng = parseFloat(q.get('lng'));
    if (!isFinite(lat) || !isFinite(lng)) return;
    var fake = {
      coords: { latitude: lat, longitude: lng, accuracy: 20, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: Date.now()
    };
    var geo = {
      getCurrentPosition: function (ok) { setTimeout(function () { ok(fake); }, 60); },
      watchPosition: function (cb) { setTimeout(function () { cb(fake); }, 120); return 1; },
      clearWatch: function () {}
    };
    // navigator.geolocation 是只读访问器，直接赋值会静默失败 —— 必须 defineProperty
    try {
      Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true, writable: true });
    } catch (e) {
      try { navigator.geolocation = geo; } catch (e2) {}
    }
    document.title = 'geo-stub ' + lat + ',' + lng;
  })();
  </script>
"""

out = src.replace("</head>", stub + "</head>", 1)
assert stub in out, "stub 未注入"
p = os.path.join(root, "_geo_test.html")
open(p, "w", encoding="utf-8").write(out)
print("written", p)

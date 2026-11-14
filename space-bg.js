/* LUNARIS · interactive space background: three star layers + planets that drift with the mouse and the scroll. */
(function () {
  const cv = document.getElementById("space"), cx = cv.getContext("2d"), reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  let W, H, dpr, mx = 0, my = 0, sx = 0, sy = 0, stars = [];
  const layers = [{ n: 150, z: .015, s: 1 }, { n: 80, z: .04, s: 1.4 }, { n: 35, z: .09, s: 2 }];
  const planets = [                       // x,y as fractions of the screen; z = parallax depth; r in px
    { x: .97, y: .90, r: 150, z: .10, c: ["#9fe3ff", "#2f7fb5", "#06172e"], atm: "#72d9ff" },   // Earth-like
    { x: .08, y: .72, r: 46, z: .16, c: ["#ffb58a", "#b4532f", "#3a140a"], atm: "#ff9a66" },    // Mars-like
    { x: .70, y: .86, r: 64, z: .06, c: ["#f1dcae", "#b9955a", "#3b2a14"], ring: true },        // ringed giant
    { x: .30, y: .10, r: 22, z: .22, c: ["#d9e4ee", "#8392a2", "#222a33"] }                      // small moon
  ];
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = []; layers.forEach((l, li) => { for (let i = 0; i < l.n * (W * H / 1.2e6); i++) stars.push({ x: Math.random(), y: Math.random(), l: li, p: Math.random() * 6.28 }); });
  }
  const wrap = (v, m) => ((v % m) + m) % m;
  function draw(t) {
    sx += (mx - sx) * .06; sy += (my - sy) * .06;
    const sc = scrollY; cx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const L = layers[s.l], x = wrap(s.x * W - sx * L.z * 900, W), y = wrap(s.y * H - sy * L.z * 900 - sc * L.z * 2.2, H);
      cx.globalAlpha = (.35 + .35 * Math.sin(t / 900 + s.p)) * (s.l === 2 ? 1 : .8) + .15; cx.fillStyle = s.l === 2 ? "#ffe9c4" : "#d8e9ff"; cx.fillRect(x, y, L.s, L.s);
    }
    cx.globalAlpha = 1;
    for (const p of planets) {
      const x = p.x * W - sx * p.z * 700, y = wrap(p.y * H - sy * p.z * 700 - sc * p.z * 1.6 + 200, H + 400) - 200;
      if (p.ring) { cx.save(); cx.translate(x, y); cx.rotate(-.35); cx.strokeStyle = "#e8cf9a55"; cx.lineWidth = 7; cx.beginPath(); cx.ellipse(0, 0, p.r * 1.9, p.r * .5, 0, Math.PI, 2 * Math.PI); cx.stroke(); cx.restore(); }
      const g = cx.createRadialGradient(x - p.r * .35, y - p.r * .35, p.r * .1, x, y, p.r); g.addColorStop(0, p.c[0]); g.addColorStop(.55, p.c[1]); g.addColorStop(1, p.c[2]);
      cx.save(); cx.shadowColor = p.atm || "#0000"; cx.shadowBlur = p.atm ? p.r * .5 : 0; cx.globalAlpha = .88; cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, p.r, 0, 6.283); cx.fill(); cx.restore();
      if (p.ring) { cx.save(); cx.translate(x, y); cx.rotate(-.35); cx.strokeStyle = "#e8cf9a88"; cx.lineWidth = 7; cx.beginPath(); cx.ellipse(0, 0, p.r * 1.9, p.r * .5, 0, 0, Math.PI); cx.stroke(); cx.restore(); }
    }
    if (!reduce) requestAnimationFrame(draw);
  }
  addEventListener("pointermove", e => { mx = e.clientX / W - .5; my = e.clientY / H - .5; });
  addEventListener("resize", size); size();
  if (reduce) { draw(0); addEventListener("scroll", () => draw(0), { passive: true }); } else requestAnimationFrame(draw);
})();

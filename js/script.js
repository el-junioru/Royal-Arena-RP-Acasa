/* ---------- script.js (complet) ---------- */

/* Clipboard pentru IP */
(function(){
  if (typeof ClipboardJS !== 'undefined') {
    var clipboard1 = new ClipboardJS('.main-button.copy');
    clipboard1.on('success', function(e){
      try{ if (window.yaCounter46328574) yaCounter46328574.reachGoal('copygta5'); }catch(_){}
      var old = e.trigger.textContent;
      e.trigger.textContent = 'Copiat';
      setTimeout(function(){ e.trigger.textContent = old; }, 2000);
    });
  }
})();

/* Header: vizibil de la început; la scroll doar intensifică fundalul */
(function(){
  var tl = document.querySelector('header .topline');
  if(!tl) return;
  var ticking = false;
  function onScroll(){
    if(!ticking){
      requestAnimationFrame(function(){
        tl.classList.toggle('scrolled', window.scrollY > 20);
        ticking = false;
      });
      ticking = true;
    }
  }
  onScroll();
  window.addEventListener('scroll', onScroll, {passive:true});
})();

/* Parallax “smooth” în header (lerp) */
(function(){
  var girl  = document.querySelector('header .girl-header');
  var title = document.querySelector('header .info-server');
  var header = document.querySelector('header');
  if(!header) return;

  var rect = header.getBoundingClientRect();
  var cx = rect.width/2, cy = rect.height/2;
  var tx=0, ty=0, x=0, y=0;

  function resize(){
    rect = header.getBoundingClientRect();
    cx = rect.width/2; cy = rect.height/2;
  }
  window.addEventListener('resize', resize, {passive:true});

  document.addEventListener('mousemove', function(ev){
    tx = (ev.clientX - cx) / rect.width;
    ty = (ev.clientY - cy) / rect.height;
  }, {passive:true});

  function lerp(a,b,t){ return a + (b-a)*t; }
  (function raf(){
    x = lerp(x, tx, 0.08);
    y = lerp(y, ty, 0.08);
    if(girl)  girl.style.transform  = 'translate3d(' + (-x*24) + 'px,' + (-y*12) + 'px,0)';
    if(title) title.style.transform = 'skewY(-4deg) translate3d(' + (x*14) + 'px,' + (y*8) + 'px,0)';
    requestAnimationFrame(raf);
  })();
})();

/* Reveal “smooth” pentru cardurile pașilor + butoanele lor */
(function(){
  var items = document.querySelectorAll('.guide-staps > div');
  if(!items.length) return;

  items.forEach(function(el){
    el.classList.remove('is-in'); // starea inițială; CSS face animația
  });

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(ent){
      if(ent.isIntersecting){
        ent.target.classList.add('is-in'); // declanșează animația CSS
        io.unobserve(ent.target);
      }
    });
  }, { threshold:0.25, rootMargin:'0px 0px -10% 0px' });

  items.forEach(function(el){ io.observe(el); });
})();

/* Ușor lift pe hover pentru toate butoanele principale */
(function(){
  document.querySelectorAll('.main-button').forEach(function(btn){
    btn.addEventListener('mouseenter', function(){ btn.style.transform = 'translateY(-3px)'; });
    btn.addEventListener('mouseleave', function(){ btn.style.transform = ''; });
  });
})();
/* Fade-in la scroll (IntersectionObserver) */
(function(){
  var map = [
    'header .info-server',
    '.game-servers .server',
    '.guide-staps > div',
    'footer .social-links .link'
  ];
  map.forEach(function(sel){
    document.querySelectorAll(sel).forEach(function(el, i){
      if(!el.hasAttribute('data-animate')){
        el.setAttribute('data-animate','fade-in');
        el.style.setProperty('--fade-dur','.8s');
        el.style.transitionDelay = (i*70)+'ms'; // mic stagger
      }
    });
  });

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(ent){
      if(ent.isIntersecting){
        ent.target.classList.add('in');
        io.unobserve(ent.target);
      }
    });
  }, {threshold:0.18, rootMargin:'0px 0px -8% 0px'});

  document.querySelectorAll('[data-animate="fade-in"]').forEach(function(el){ io.observe(el); });
})();
/* ----- Nav activ pe secțiuni (Pagina principală / Cum să începi să joci) ----- */
(function(){
  var headerEl = document.querySelector('header');
  var stapsEl  = document.querySelector('#staps');
  var menu     = document.querySelector('.header-menu');
  if(!headerEl || !stapsEl || !menu) return;

  var liHome  = menu.querySelector('li:nth-child(1)');                   // "Pagina principală"
  var liStaps = menu.querySelector('a[href="#staps"]')?.closest('li');   // "Cum să începi să joci"
  if(!liHome || !liStaps) return;

  function setActive(li){
    [liHome, liStaps].forEach(function(x){ x.classList.remove('active'); });
    li.classList.add('active');
  }

  function y(el){ return el.getBoundingClientRect().top + window.scrollY; }

  var headerHeight = document.querySelector('header .topline')?.offsetHeight || 0;

  function update(){
    var scroll = window.scrollY + headerHeight + 20; // ține cont de bara fixă
    var stapsTop = y(stapsEl);
    if (scroll >= stapsTop) setActive(liStaps);
    else setActive(liHome);
  }

  // smooth offset corect când dai click pe #staps
  menu.addEventListener('click', function(e){
    var a = e.target.closest('a[href^="#"]');
    if(!a) return;
    var id = a.getAttribute('href');
    if(id === '#staps'){
      e.preventDefault();
      var top = y(stapsEl) - headerHeight - 12;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  });

  // raf-throttled scroll
  var ticking = false;
  window.addEventListener('scroll', function(){
    if(!ticking){
      requestAnimationFrame(function(){ update(); ticking = false; });
      ticking = true;
    }
  }, {passive:true});
  window.addEventListener('resize', function(){ headerHeight = document.querySelector('header .topline')?.offsetHeight || 0; update(); }, {passive:true});

  update();
})();
/* Tabs + carousels pentru secțiunea "Despre proiect" */
(function(){
  // Tabs
  var tabs = document.querySelectorAll('.about-tabs .tab');
  var panes = {
    roleplay: document.getElementById('tab-roleplay'),
    sisteme: document.getElementById('tab-sisteme'),
    evenimente: document.getElementById('tab-evenimente')
  };
  tabs.forEach(function(btn){
    btn.addEventListener('click', function(){
      tabs.forEach(function(b){ b.classList.remove('active'); });
      Object.values(panes).forEach(function(p){ p.classList.remove('active'); });
      btn.classList.add('active');
      var key = btn.getAttribute('data-tab');
      if (panes[key]) panes[key].classList.add('active');
    });
  });

  // Carousels
  document.querySelectorAll('.carousel').forEach(function(c){
    var imgs = c.querySelectorAll('img');
    if(!imgs.length) return;
    var dotsWrap = c.querySelector('.dots');
    var dots = [];
    imgs[0].classList.add('active');
    imgs.forEach(function(_,i){
      var d = document.createElement('i');
      if(i===0) d.classList.add('active');
      d.addEventListener('click', function(){ go(i); });
      dotsWrap.appendChild(d);
      dots.push(d);
    });
    var iCur = 0, t;
    function go(n){
      imgs[iCur].classList.remove('active'); dots[iCur].classList.remove('active');
      iCur = (n+imgs.length)%imgs.length;
      imgs[iCur].classList.add('active'); dots[iCur].classList.add('active');
      restart();
    }
    function next(){ go(iCur+1); }
    function restart(){ clearInterval(t); t = setInterval(next, 3500); }
    restart();
  });
})();

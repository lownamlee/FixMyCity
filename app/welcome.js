(() => {
      'use strict';
      const stage = document.querySelector('.stage');
      const template = document.querySelector('#onboarding');
      const params = new URLSearchParams(location.search);
      const gallery = params.get('view') === 'all';
      const hashStep = /^#welcome-([123])$/.exec(location.hash);
      const requestedPage = hashStep ? Number(hashStep[1]) : Number(params.get('page'));
      const firstPage = Number.isFinite(requestedPage) ? Math.trunc(requestedPage || 1) : 1;
      const previews = gallery ? [0, 1, 2] : [Math.min(2, Math.max(0, firstPage - 1))];
      const devices = [];
      const titles = ['A Cleaner, Safer City Starts With You', 'Report with AI', 'Track Progress. Earn Recognition.'];
      stage.classList.toggle('is-gallery', gallery);
      for (const initial of previews) {
        const device = template.content.firstElementChild.cloneNode(true);
        // Every gallery clone needs its own SVG mask/clip IDs.
        const suffix = `-welcome-${devices.length}`;
        const references = new Map([...device.querySelectorAll('[id]')].map(node => [node.id, node.id + suffix]));
        for (const node of device.querySelectorAll('*')) {
          for (const attribute of [...node.attributes]) {
            let value = attribute.value;
            if (attribute.name === 'id') value = references.get(value) || value;
            else for (const [id, replacement] of references) {
              value = value.replaceAll(`url(#${id})`, `url(#${replacement})`);
              if (value === `#${id}`) value = `#${replacement}`;
            }
            if (value !== attribute.value) node.setAttribute(attribute.name, value);
          }
        }
        stage.append(device);
        const canvas = device.querySelector('.canvas');
        const pages = device.querySelector('.pages');
        const panels = [...device.querySelectorAll('.page')];
        const dots = [...device.querySelectorAll('.dot')];
        const next = device.querySelector('.next');
        const start = device.querySelector('.start');
        const live = device.querySelector('.announcement');
        let index = initial;
        let gesture = null;
        function loadArtwork(panel) {
          if (!panel) return;
          for (const image of panel.querySelectorAll('[data-asset]')) {
            image.setAttribute(image.localName === 'image' ? 'href' : 'src', image.dataset.asset);
            image.removeAttribute('data-asset');
          }
        }
        function select(step, announce = true, historyMode = 'push') {
          index = Math.min(2, Math.max(0, step));
          loadArtwork(panels[index]);
          if (!gallery && historyMode !== 'none') {
            const hash = `#welcome-${index + 1}`;
            if (location.hash !== hash) {
              history[historyMode === 'replace' ? 'replaceState' : 'pushState']({ ...history.state, fmcWelcome: index + 1 }, '', hash);
            }
          }
          if (!gallery) document.title = `Welcome ${index + 1} of 3 · FixMyCity`;
          device.dataset.page = String(index + 1);
          pages.style.transform = `translateX(${-100 * index}%)`;
          panels.forEach((panel, i) => {
            panel.inert = i !== index;
            panel.setAttribute('aria-hidden', String(i !== index));
          });
          dots.forEach((dot, i) => {
            if (i === index) dot.setAttribute('aria-current', 'step');
            else dot.removeAttribute('aria-current');
          });
          const nextHadFocus = document.activeElement === next;
          const startHadFocus = document.activeElement === start;
          next.hidden = index === 2;
          start.hidden = index !== 2;
          if (nextHadFocus && next.hidden) start.focus({ preventScroll: true });
          if (startHadFocus && start.hidden) next.focus({ preventScroll: true });
          if (announce) live.textContent = `Page ${index + 1} of 3. ${titles[index]}`;
        }
        next.addEventListener('click', () => select(index + 1));
        dots.forEach((dot, i) => dot.addEventListener('click', () => select(i)));
        device.addEventListener('keydown', event => {
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.key === 'ArrowRight') { event.preventDefault(); select(index + 1); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); select(index - 1); }
        });
        canvas.addEventListener('pointerdown', event => {
          if (!event.isPrimary || event.target.closest('button,a')) return;
          gesture = { x: event.clientX, y: event.clientY, id: event.pointerId };
          canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener('pointerup', event => {
          if (!gesture || event.pointerId !== gesture.id) return;
          const dx = event.clientX - gesture.x;
          const dy = event.clientY - gesture.y;
          gesture = null;
          if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) select(index + (dx < 0 ? 1 : -1));
        });
        canvas.addEventListener('pointercancel', () => { gesture = null; });
        select(initial, false, 'replace');
        if (gallery) panels.forEach(loadArtwork);
        if (!gallery) {
          const restoreSlide = () => {
            const match = /^#welcome-([123])$/.exec(location.hash);
            select(match ? Number(match[1]) - 1 : 0, true, 'none');
          };
          addEventListener('popstate', restoreSlide);
          addEventListener('hashchange', restoreSlide);
        }
        const finishWelcome = async event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (window.FMCFlow) {
            await window.FMCFlow.ready;
            window.FMCFlow.complete('welcome');
            await window.FMCFlow.go('scan-card');
          } else location.assign('scan-card');
        };
        device.querySelector('.skip').addEventListener('click', async event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          await window.FMCFlow?.skipVerification();
        });
        start.addEventListener('click', finishWelcome);
        devices.push({ device, canvas });
      }
      function layout() {
        const mobile = innerWidth <= 520 && !gallery;
        const scale = gallery
          ? Math.min(1, (innerWidth - 150) / (390 * 3), (innerHeight - 88) / 844)
          : Math.min(1, (innerWidth - 66) / 390, (innerHeight - 70) / 844);
        for (const { device, canvas } of devices) {
          if (mobile) {
            const width = document.documentElement.clientWidth;
            const ratio = width / 390;
            const height = Math.max(innerHeight, 700 * ratio);
            device.style.width = `${width}px`;
            device.style.height = `${height}px`;
            canvas.style.height = `${height / ratio}px`;
            canvas.style.transform = `scale(${ratio})`;
            device.dataset.compact = String(height / ratio < 790);
          } else {
            const ratio = Math.max(.22, scale);
            device.style.width = `${390 * ratio}px`;
            device.style.height = `${844 * ratio}px`;
            canvas.style.height = '844px';
            canvas.style.transform = `scale(${ratio})`;
            device.dataset.compact = 'false';
          }
        }
      }
      addEventListener('resize', layout, { passive: true });
      const pauseScenes = () => { document.documentElement.dataset.scenePaused = String(document.hidden); };
      document.addEventListener('visibilitychange', pauseScenes);
      pauseScenes();
      new ResizeObserver(layout).observe(stage);
      layout();
    })();


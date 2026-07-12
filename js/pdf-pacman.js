(function() {
    var container = document.getElementById('pdf-container-pacman');
    if (!container) return;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfjsLib.getDocument('/files/Pacman.pdf').promise.then(function(pdf) {
        for (var i = 1; i <= pdf.numPages; i++) {
            pdf.getPage(i).then(function(page) {
                var scale = 4.5;
                var viewport = page.getViewport({ scale: scale });
                var canvas = document.createElement('canvas');
                canvas.style.display = 'block';
                canvas.style.margin = '0 auto 20px';
                canvas.style.maxWidth = '100%';
                canvas.style.height = 'auto';
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                container.appendChild(canvas);
                page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport });
            });
        }
    });
})();

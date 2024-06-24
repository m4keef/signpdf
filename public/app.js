document.addEventListener('DOMContentLoaded', function () {
    const loginContainer = document.getElementById('login-container');
    const pdfContainer = document.getElementById('pdf-container');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePenBtn = document.getElementById('toggle-pen-btn');
    let penEnabled = false;

    loginBtn.addEventListener('click', function () {
        const username = usernameInput.value;
        const password = passwordInput.value;
        if (username === 'admin' && password === 'Admin123*') {
            localStorage.setItem('auth', 'true');
            loginContainer.style.display = 'none';
            pdfContainer.style.display = 'block';
        } else {
            loginError.style.display = 'block';
        }
    });

    if (localStorage.getItem('auth') === 'true') {
        loginContainer.style.display = 'none';
        pdfContainer.style.display = 'block';
    }

    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    togglePenBtn.addEventListener('click', togglePenMode);

    let pdfDoc = null;
    let scale = 1.5;
    let signaturePads = [];
    let signatureContexts = [];
    const pdfPages = document.getElementById('pdf-pages'); // Define pdfPages

    function handleFileUpload(event) {
        const file = event.target.files[0];
        console.log('File uploaded:', file);

        if (file && file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = function (e) {
                console.log('File read as array buffer');
                loadPDF(e.target.result);
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert('Please upload a valid PDF file.');
        }
    }

    function loadPDF(arrayBuffer) {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

        loadingTask.promise.then(pdf => {
            console.log('PDF loaded successfully');
            pdfDoc = pdf;
            renderPages();
            document.getElementById('save-btn').style.display = 'block'; // Show the save button
        }).catch(error => {
            console.error('Error loading PDF:', error);
        });
    }

    async function renderPages() {
        pdfPages.innerHTML = ''; // Clear previous pages
        signaturePads = [];
        signatureContexts = [];

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            await renderPage(i);
        }
    }

    async function renderPage(pageNumber) {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: scale });
        const pageContainer = document.createElement('div');
        pageContainer.classList.add('pdf-page');
        pageContainer.style.width = `${viewport.width}px`;
        pageContainer.style.height = `${viewport.height}px`;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const signatureCanvas = document.createElement('canvas');
        signatureCanvas.width = viewport.width;
        signatureCanvas.height = viewport.height;
        signatureCanvas.classList.add('signature-canvas');
        signaturePads.push(signatureCanvas);
        const signatureCtx = signatureCanvas.getContext('2d');
        signatureContexts.push(signatureCtx);

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderContext).promise;
        pageContainer.appendChild(canvas);
        pageContainer.appendChild(signatureCanvas);
        pdfPages.appendChild(pageContainer);
        console.log(`Page ${pageNumber} rendered`);

        // Attach event listeners for drawing
        signatureCanvas.addEventListener('mousedown', startDrawing.bind(null, signatureCtx));
        signatureCanvas.addEventListener('mouseup', stopDrawing);
        signatureCanvas.addEventListener('mousemove', draw.bind(null, signatureCtx));
    }

    function togglePenMode() {
        penEnabled = !penEnabled;
        if (penEnabled) {
            togglePenBtn.textContent = 'Disable Pen';
        } else {
            togglePenBtn.textContent = 'Enable Pen';
        }
    }

    async function savePDF() {
        const pdfLib = window.PDFLib;
        const existingPdfBytes = await pdfDoc.getData();
        const pdfDocLib = await pdfLib.PDFDocument.load(existingPdfBytes);
        const pages = pdfDocLib.getPages();

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const pngData = signaturePads[i] ? signaturePads[i].toDataURL() : null;
            if (pngData) {
                const pngImage = await pdfDocLib.embedPng(pngData);
                const { width, height } = page.getSize();
                page.drawImage(pngImage, {
                    x: 0,
                    y: 0,
                    width: width,
                    height: height
                });
            }
        }

        const newPdfBytes = await pdfDocLib.save();
        const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'signed.pdf';
        link.click();

        saveToServer(blob);
    }

    async function saveToServer(blob) {
        const formData = new FormData();
        const date = new Date();
        const year = date.getFullYear().toString();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const filePath = `${year}/${month}/${day}/signed.pdf`;

        formData.append('pdf', blob, 'signed.pdf');

        try {
            const response = await fetch('/save-pdf', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const result = await response.json();
            alert('PDF saved successfully on the server.');
        } catch (error) {
            console.error('Error saving PDF:', error);
            alert('Error saving PDF. Please try again.');
        }
    }

    document.getElementById('save-btn').addEventListener('click', savePDF);

    let isDrawing = false;

    function startDrawing(ctx, event) {
        if (!penEnabled) return;
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(event.offsetX, event.offsetY);
    }

    function stopDrawing() {
        isDrawing = false;
    }

    function draw(ctx, event) {
        if (!isDrawing) return;
        ctx.lineTo(event.offsetX, event.offsetY);
        ctx.stroke();
    }
});

// ===== Global Limits =====
const MAX_FILE_MB = 20;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MIN_TARGET_KB = 20;

function isOverLimit(file) {
  return file && file.size > MAX_FILE_BYTES;
}

// ===== Helpers =====
function bytesToKB(bytes) { return bytes / 1024; }

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawImageToCanvas(img, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

// ===== 1) NORMAL COMPRESS (20MB max) =====
async function compressImage() {
  try {
    const file = document.getElementById("compressFile")?.files?.[0];
    const qInput = document.getElementById("compressQuality")?.value;
    const mime = document.getElementById("compressFormat")?.value || "image/jpeg";

    if (!file) return setText("compressStatus", "Result: Please choose an image");
    if (isOverLimit(file)) return setText("compressStatus", `Result: ❌ Max allowed image size is ${MAX_FILE_MB}MB`);

    const quality = Math.min(0.95, Math.max(0.01, Number(qInput) / 100 || 0.75));
    setText("compressStatus", "Result: Processing...");

    const src = await fileToDataURL(file);
    const img = await loadImage(src);

    const canvas = drawImageToCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    const blob = await canvasToBlob(canvas, mime, quality);
    if (!blob) return setText("compressStatus", "Result: Failed");

    setText("compressStatus",
      `Result: Original ${bytesToKB(file.size).toFixed(2)} KB → Output ${bytesToKB(blob.size).toFixed(2)} KB`
    );

    const ext = mime === "image/webp" ? "webp" : "jpg";
    downloadBlob(blob, `compressed.${ext}`);
  } catch {
    setText("compressStatus", "Result: Error");
  }
}

// ===== 2) CONVERT (20MB max) =====
async function convertImage() {
  try {
    const file = document.getElementById("convertFile")?.files?.[0];
    const mime = document.getElementById("format")?.value || "image/jpeg";

    if (!file) return setText("convertStatus", "Result: Please choose an image");
    if (isOverLimit(file)) return setText("convertStatus", `Result: ❌ Max allowed image size is ${MAX_FILE_MB}MB`);

    setText("convertStatus", "Result: Converting...");

    const src = await fileToDataURL(file);
    const img = await loadImage(src);

    const canvas = drawImageToCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    const quality = (mime === "image/png") ? undefined : 0.92;
    const blob = await canvasToBlob(canvas, mime, quality);
    if (!blob) return setText("convertStatus", "Result: Failed");

    setText("convertStatus", `Result: Output ${bytesToKB(blob.size).toFixed(2)} KB`);

    const ext = mime === "image/png" ? "png" : (mime === "image/webp" ? "webp" : "jpg");
    downloadBlob(blob, `converted.${ext}`);
  } catch {
    setText("convertStatus", "Result: Error");
  }
}

// ===== 3) RESIZE (20MB max) =====
async function resizeImage() {
  try {
    const file = document.getElementById("resizeFile")?.files?.[0];
    const w = Number(document.getElementById("width")?.value);
    const h = Number(document.getElementById("height")?.value);
    const mime = document.getElementById("resizeFormat")?.value || "image/jpeg";

    if (!file) return setText("resizeStatus", "Result: Please choose an image");
    if (isOverLimit(file)) return setText("resizeStatus", `Result: ❌ Max allowed image size is ${MAX_FILE_MB}MB`);
    if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return setText("resizeStatus", "Result: Enter valid width & height");

    setText("resizeStatus", "Result: Resizing...");

    const src = await fileToDataURL(file);
    const img = await loadImage(src);

    const canvas = drawImageToCanvas(img, w, h);
    const quality = (mime === "image/png") ? undefined : 0.92;
    const blob = await canvasToBlob(canvas, mime, quality);
    if (!blob) return setText("resizeStatus", "Result: Failed");

    setText("resizeStatus", `Result: Output ${bytesToKB(blob.size).toFixed(2)} KB (${w}×${h})`);

    const ext = mime === "image/png" ? "png" : (mime === "image/webp" ? "webp" : "jpg");
    downloadBlob(blob, `resized.${ext}`);
  } catch {
    setText("resizeStatus", "Result: Error");
  }
}

// ===== 4) TARGET KB TOOL (20MB max + min 20KB) =====
(function initTargetKBTool() {
  const fileInput = document.getElementById("tkFile");
  const info = document.getElementById("tkInfo");
  const targetKbEl = document.getElementById("tkTargetKb");
  const formatEl = document.getElementById("tkFormat");
  const maxWidthEl = document.getElementById("tkMaxWidth");
  const startBtn = document.getElementById("tkStart");
  const resultEl = document.getElementById("tkResult");
  const downloadA = document.getElementById("tkDownload");
  const preview = document.getElementById("tkPreview");

  if (!fileInput || !startBtn) return;

  let selectedFile = null;

  function setResult(text) {
    if (resultEl) resultEl.textContent = `Result: ${text}`;
  }

  function hideOutput() {
    if (downloadA) downloadA.style.display = "none";
    if (preview) preview.style.display = "none";
  }

  fileInput.addEventListener("change", () => {
    selectedFile = fileInput.files?.[0] || null;
    hideOutput();

    if (!selectedFile) {
      if (info) info.textContent = "No file chosen";
      setResult("—");
      return;
    }

    if (isOverLimit(selectedFile)) {
      if (info) info.textContent = `❌ Max allowed image size is ${MAX_FILE_MB}MB`;
      selectedFile = null;
      return;
    }

    const mb = selectedFile.size / (1024 * 1024);
    if (info) info.textContent = `${selectedFile.name} — ${mb.toFixed(2)} MB`;
    setResult("—");
  });

  startBtn.addEventListener("click", async () => {
    try {
      if (!selectedFile) return setResult("Please choose an image (Max 20MB)");

      const targetKb = Number(targetKbEl.value);
      if (!isFinite(targetKb) || targetKb <= 0) return setResult("Enter valid Target KB (e.g. 200)");
      if (targetKb < MIN_TARGET_KB) return setResult(`❌ Minimum target size is ${MIN_TARGET_KB}KB`);

      const mime = formatEl.value || "image/jpeg";
      const mw = Number(maxWidthEl.value);
      const maxW = isFinite(mw) && mw > 0 ? mw : null;

      setResult("Compressing...");
      hideOutput();

      const dataUrl = await fileToDataURL(selectedFile);
      const img = await loadImage(dataUrl);

      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (maxW && w > maxW) {
        const r = maxW / w;
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      let canvas = drawImageToCanvas(img, w, h);

      const targetBytes = targetKb * 1024;

      // Try quality search
      let low = 0.05, high = 0.95;
      let best = null;

      const first = await canvasToBlob(canvas, mime, high);
      if (!first) return setResult("Compression failed");

      if (first.size <= targetBytes) {
        best = first;
      } else {
        for (let i = 0; i < 12; i++) {
          const mid = (low + high) / 2;
          const b = await canvasToBlob(canvas, mime, mid);
          if (!b) break;

          if (b.size <= targetBytes) { best = b; low = mid; }
          else { high = mid; }
        }

        // If still too big: reduce size a little
        if (!best) {
          let cw = canvas.width, ch = canvas.height;
          let tmp = canvas;

          for (let s = 0; s < 6; s++) {
            cw = Math.round(cw * 0.9);
            ch = Math.round(ch * 0.9);
            const c = document.createElement("canvas");
            c.width = cw; c.height = ch;
            c.getContext("2d").drawImage(tmp, 0, 0, cw, ch);
            tmp = c;

            const b = await canvasToBlob(tmp, mime, 0.7);
            if (b && b.size <= targetBytes) { best = b; canvas = tmp; break; }
          }
        }
      }

      if (!best) return setResult("Target bahut low hai. Target KB badhao ya Max width 1280/720 set karo.");

      const url = URL.createObjectURL(best);
      const outKb = bytesToKB(best.size).toFixed(2);

      const ext = mime === "image/webp" ? "webp" : "jpg";
      downloadA.href = url;
      downloadA.download = `target.${ext}`;
      downloadA.style.display = "inline-block";
      downloadA.textContent = "Download";

      preview.src = url;
      preview.style.display = "block";

      setResult(`Done ✅ Output: ${outKb} KB (Target: ${targetKb} KB)`);
    } catch {
      setResult("Error");
    }
  });
})();

// Auto select width when image selected
document.querySelector('input[type="file"]').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = function() {
        const originalWidth = img.width;

        let autoWidth;

        if (originalWidth > 3000) {
            autoWidth = 1280;
        } 
        else if (originalWidth > 2000) {
            autoWidth = 1080;
        } 
        else if (originalWidth > 1000) {
            autoWidth = 720;
        } 
        else {
            autoWidth = originalWidth;
        }

        document.getElementById("maxWidth").value = autoWidth;

        URL.revokeObjectURL(url);
    };

    img.src = url;
});

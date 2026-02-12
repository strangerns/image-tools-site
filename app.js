const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const selectBtn = document.getElementById("selectBtn");
const compressBtn = document.getElementById("compressBtn");
const clearBtn = document.getElementById("clearBtn");
const targetKBEl = document.getElementById("targetKB");
const maxWidthEl = document.getElementById("maxWidth");
const outFormatEl = document.getElementById("outFormat");
const statusLine = document.getElementById("statusLine");
const list = document.getElementById("list");
const progressBar = document.getElementById("progressBar");

let selectedFiles = [];

selectBtn.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files?.length) handleFiles(e.target.files);
});

clearBtn.addEventListener("click", () => {
  selectedFiles = [];
  fileInput.value = "";
  list.innerHTML = "";
  progressBar.style.width = "0%";
  statusLine.textContent = "Result: —";
});

function handleFiles(fileList) {
  selectedFiles = Array.from(fileList).filter(f => f.type.startsWith("image/"));
  if (!selectedFiles.length) {
    statusLine.textContent = "Result: Please select image files only.";
    return;
  }
  statusLine.textContent = `Result: ${selectedFiles.length} image(s) selected.`;
  list.innerHTML = "";

  // Auto set max width based on first image dimension
  autoSetWidth(selectedFiles[0]);

  // Show preview list
  selectedFiles.forEach((f) => {
    const div = document.createElement("div");
    div.className = "fileItem";
    div.innerHTML = `
      <div class="fileMeta">
        <b>${escapeHtml(f.name)}</b>
        <div class="small">Original: ${formatBytes(f.size)}</div>
      </div>
      <div class="small">Ready</div>
    `;
    list.appendChild(div);
  });
}

function autoSetWidth(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const w = img.width;
    let autoWidth;
    if (w > 3000) autoWidth = 1280;
    else if (w > 2000) autoWidth = 1080;
    else if (w > 1200) autoWidth = 720;
    else autoWidth = w;

    // only set if empty (user can override)
    if (!maxWidthEl.value) maxWidthEl.value = autoWidth;

    URL.revokeObjectURL(url);
  };
  img.src = url;
}

compressBtn.addEventListener("click", async () => {
  if (!selectedFiles.length) {
    statusLine.textContent = "Result: Please select images first.";
    return;
  }

  const targetKB = clamp(parseInt(targetKBEl.value || "0", 10), 10, 20000);
  const maxWidth = parseInt(maxWidthEl.value || "0", 10) || 0;
  const mime = outFormatEl.value;

  progressBar.style.width = "0%";
  statusLine.textContent = "Result: Compressing…";

  for (let i = 0; i < selectedFiles.length; i++) {
    const f = selectedFiles[i];
    const outBlob = await compressToTargetKB(f, targetKB, maxWidth, mime, (p) => {
      const overall = Math.round(((i + p) / selectedFiles.length) * 100);
      progressBar.style.width = `${overall}%`;
    });

    downloadBlob(outBlob, makeOutName(f.name, mime, targetKB));

    // update list item text
    const item = list.children[i];
    if (item) {
      item.querySelector(".small").textContent = `Original: ${formatBytes(f.size)} → Output: ${formatBytes(outBlob.size)}`;
      item.querySelectorAll(".small")[1].textContent = "Downloaded";
    }
  }

  progressBar.style.width = "100%";
  statusLine.textContent = "Result: Done ✅ Files downloaded.";
});

async function compressToTargetKB(file, targetKB, maxWidth, mime, onProgress) {
  const img = await fileToImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // resize
  const ratio = img.width / img.height;
  let w = img.width;
  let h = img.height;
  if (maxWidth > 0 && img.width > maxWidth) {
    w = maxWidth;
    h = Math.round(w / ratio);
  }
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  // PNG cannot be "quality" compressed much; if PNG selected and target very low, webp/jpg better
  const targetBytes = targetKB * 1024;

  // quality search (binary)
  let lo = 0.2, hi = 0.95;
  let bestBlob = await canvasToBlob(canvas, mime, hi);

  // if already <= target, return it
  if (bestBlob.size <= targetBytes) return bestBlob;

  for (let step = 0; step < 10; step++) {
    const mid = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, mime, mid);

    if (blob.size > targetBytes) {
      hi = mid;
    } else {
      lo = mid;
      bestBlob = blob;
    }
    onProgress?.((step + 1) / 10);
  }

  // If still too big, reduce width slightly and retry once (helps hard targets)
  if (bestBlob.size > targetBytes && w > 720) {
    const w2 = Math.max(720, Math.floor(w * 0.8));
    const h2 = Math.round(w2 / ratio);
    canvas.width = w2;
    canvas.height = h2;
    ctx.drawImage(img, 0, 0, w2, h2);

    let lo2 = 0.2, hi2 = 0.9;
    bestBlob = await canvasToBlob(canvas, mime, hi2);
    for (let step = 0; step < 8; step++) {
      const mid = (lo2 + hi2) / 2;
      const blob = await canvasToBlob(canvas, mime, mid);
      if (blob.size > targetBytes) hi2 = mid;
      else { lo2 = mid; bestBlob = blob; }
      onProgress?.(0.6 + (step + 1) / 20);
    }
  }

  return bestBlob;
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeOutName(originalName, mime, targetKB) {
  const base = originalName.replace(/\.[^/.]+$/, "");
  const ext = mime === "image/png" ? "png" : (mime === "image/webp" ? "webp" : "jpg");
  return `${base}-${targetKB}kb.${ext}`;
}

function formatBytes(bytes) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function escapeHtml(s){
  return (s || "").replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

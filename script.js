const imageInput = document.getElementById("image-input");
const uploadArea = document.getElementById("upload-area");
const uploadContent = document.getElementById("upload-content");
const previewImage = document.getElementById("preview-image");

const chooseButton = document.getElementById("choose-button");
const changeButton = document.getElementById("change-button");
const removeButton = document.getElementById("remove-button");

const fileDetails = document.getElementById("file-details");
const fileName = document.getElementById("file-name");
const statusMessage = document.getElementById("status-message");

const resultArea = document.getElementById("result-area");
const resultImage = document.getElementById("result-image");
const resultPreview = document.getElementById("result-preview");
const downloadButton = document.getElementById("download-button");

const colorOptions = document.querySelectorAll(".color-option");
const customColorInput = document.getElementById("custom-color");

let selectedFile = null;
let previewUrl = null;

// URL gambar asli yang background-nya sudah dihapus AI
let originalResultUrl = null;

// URL hasil akhir yang akan ditampilkan dan diunduh
let resultUrl = null;

let isProcessing = false;
let isChangingBackground = false;

const MAX_FILE_SIZE = 15 * 1024 * 1024;

// Warna background yang sedang dipilih
let selectedBackground = "transparent";

// Menampilkan pesan status
function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
}

// Membuka pemilih foto
function openFilePicker() {
    if (!isProcessing) {
        imageInput.click();
    }
}

chooseButton.addEventListener("click", openFilePicker);
changeButton.addEventListener("click", openFilePicker);

// Memeriksa dan memilih foto
imageInput.addEventListener("change", function () {
    const file = imageInput.files[0];

    if (file) {
        handleSelectedFile(file);
    }

    imageInput.value = "";
});

function handleSelectedFile(file) {
    if (isProcessing) return;

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        showStatus(
            "Format tidak didukung. Gunakan foto JPG, PNG, atau WEBP.",
            "error"
        );
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showStatus(
            "Ukuran foto maksimal 15 MB. Silakan pilih foto yang lebih kecil.",
            "error"
        );
        return;
    }

    selectedFile = file;

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
    }

    previewUrl = URL.createObjectURL(file);

    previewImage.src = previewUrl;
    previewImage.hidden = false;
    uploadContent.hidden = true;

    fileDetails.hidden = false;
    fileName.textContent =
        `${file.name} (${formatFileSize(file.size)})`;

    removeButton.disabled = false;

    clearResult();

    showStatus(
        "Foto siap diproses. Klik Hapus Background.",
        "success"
    );
}

function formatFileSize(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Membersihkan hasil pemrosesan sebelumnya
function clearResult() {
    if (originalResultUrl) {
        URL.revokeObjectURL(originalResultUrl);
        originalResultUrl = null;
    }

    if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
        resultUrl = null;
    }

    resultImage.removeAttribute("src");
    downloadButton.removeAttribute("href");

    resultArea.hidden = true;

    selectedBackground = "transparent";

    colorOptions.forEach(function (button) {
        button.classList.toggle(
            "active",
            button.dataset.color === "transparent"
        );
    });

    if (resultPreview) {
        resultPreview.style.backgroundColor = "transparent";
    }
}

// Menghapus background melalui backend AI
removeButton.addEventListener("click", async function () {
    if (!selectedFile || isProcessing) {
        return;
    }

    isProcessing = true;

    removeButton.disabled = true;
    chooseButton.disabled = true;
    changeButton.disabled = true;

    removeButton.innerHTML =
        "<span>⏳</span> Sedang memproses foto...";

    showStatus(
        "AI sedang menghapus background. Tunggu beberapa saat...",
        "loading"
    );

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/remove-background",
            {
                method: "POST",
                body: formData
            }
        );

        if (!response.ok) {
            let errorMessage = "Foto gagal diproses.";

            try {
                const errorData = await response.json();

                errorMessage =
                    errorData.message || errorMessage;
            } catch (_) {
                // Respons server bukan JSON
            }

            throw new Error(errorMessage);
        }

        const imageBlob = await response.blob();

        if (!imageBlob.type.startsWith("image/")) {
            throw new Error(
                "Server tidak mengembalikan gambar yang valid."
            );
        }

        clearResult();

        // Simpan gambar asli dengan background transparan.
        // Gambar ini menjadi sumber untuk semua pilihan warna.
        originalResultUrl = URL.createObjectURL(imageBlob);

        resultArea.hidden = false;

        // Tampilkan hasil transparan terlebih dahulu.
        await applyBackground("transparent");

        showStatus(
            "Berhasil! Background foto sudah dihapus.",
            "success"
        );

        resultArea.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });

    } catch (error) {
        console.error("Kesalahan pemrosesan:", error);

        showStatus(
            error.message ||
            "Tidak dapat terhubung ke server AI. Pastikan backend berjalan.",
            "error"
        );

    } finally {
        isProcessing = false;

        removeButton.disabled = !selectedFile;
        chooseButton.disabled = false;
        changeButton.disabled = false;

        removeButton.innerHTML =
            '<span>✦</span> Hapus Background ' +
            '<span class="button-arrow">→</span>';
    }
});

// Menerapkan warna background dan menyiapkan hasil unduhan
async function applyBackground(color) {
    if (!originalResultUrl || isChangingBackground) {
        return;
    }

    isChangingBackground = true;

    try {
        // Memuat gambar hasil AI yang masih transparan.
        const sourceImage = new Image();

        sourceImage.src = originalResultUrl;

        await sourceImage.decode();

        // Membuat kanvas dengan ukuran gambar asli.
        const canvas = document.createElement("canvas");

        canvas.width = sourceImage.naturalWidth;
        canvas.height = sourceImage.naturalHeight;

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error(
                "Browser tidak dapat memproses gambar."
            );
        }

        // Jika warna bukan transparan, isi background terlebih dahulu.
        if (color !== "transparent") {
            context.fillStyle = color;

            context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );
        }

        // Letakkan foto tanpa background di atas warna pilihan.
        context.drawImage(
            sourceImage,
            0,
            0,
            canvas.width,
            canvas.height
        );

        // Ekspor gambar akhir ke PNG.
        const outputBlob = await new Promise(
            function (resolve, reject) {
                canvas.toBlob(function (blob) {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(
                            new Error(
                                "Gagal membuat gambar hasil."
                            )
                        );
                    }
                }, "image/png");
            }
        );

        // Ganti URL hasil sebelumnya.
        if (resultUrl) {
            URL.revokeObjectURL(resultUrl);
        }

        resultUrl = URL.createObjectURL(outputBlob);

        // Perbarui pratinjau dan tautan unduhan.
        resultImage.src = resultUrl;
        downloadButton.href = resultUrl;

        downloadButton.download =
            color === "transparent"
                ? "backdropai-transparan.png"
                : "backdropai-background-baru.png";

        // Simpan warna yang dipilih.
        selectedBackground = color;

        // Perbarui tampilan area pratinjau.
        if (resultPreview) {
            resultPreview.style.backgroundColor =
                color === "transparent" ? "transparent" : color;
        }

        showStatus(
            color === "transparent"
                ? "Background transparan berhasil diterapkan."
                : "Background baru berhasil diterapkan.",
            "success"
        );

    } catch (error) {
        console.error("Kesalahan mengganti background:", error);

        showStatus(
            "Gagal mengganti background. Silakan coba lagi.",
            "error"
        );

    } finally {
        isChangingBackground = false;
    }
}

// Tombol pilihan warna
colorOptions.forEach(function (button) {
    button.addEventListener("click", async function () {
        if (!originalResultUrl || isChangingBackground) {
            return;
        }

        const color = button.dataset.color;

        if (!color) return;

        colorOptions.forEach(function (option) {
            option.classList.remove("active");
        });

        button.classList.add("active");

        await applyBackground(color);
    });
});

// Pemilih warna kustom
if (customColorInput) {
    customColorInput.addEventListener("input", async function () {
        if (!originalResultUrl || isChangingBackground) {
            return;
        }

        colorOptions.forEach(function (option) {
            option.classList.remove("active");
        });

        await applyBackground(customColorInput.value);
    });
}

// Mendukung drag-and-drop foto
uploadArea.addEventListener("dragover", function (event) {
    event.preventDefault();

    if (!isProcessing) {
        uploadArea.classList.add("drag-over");
    }
});

uploadArea.addEventListener("dragleave", function (event) {
    if (!uploadArea.contains(event.relatedTarget)) {
        uploadArea.classList.remove("drag-over");
    }
});

uploadArea.addEventListener("drop", function (event) {
    event.preventDefault();

    uploadArea.classList.remove("drag-over");

    if (isProcessing) return;

    const file = event.dataTransfer.files[0];

    if (file) {
        handleSelectedFile(file);
    }
});

// Membersihkan URL gambar saat halaman ditutup
window.addEventListener("beforeunload", function () {
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
    }

    if (originalResultUrl) {
        URL.revokeObjectURL(originalResultUrl);
    }

    if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
    }
});
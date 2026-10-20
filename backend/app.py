import os
from io import BytesIO

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from rembg import remove, new_session
from PIL import Image

app = Flask(__name__)
CORS(app)

session = new_session("u2net")


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "success": True,
        "message": "BackDropAI siap digunakan!"
    })


@app.route("/remove-background", methods=["POST"])
def remove_background():
    if "image" not in request.files:
        return jsonify({
            "success": False,
            "message": "Silakan unggah gambar terlebih dahulu."
        }), 400

    try:
        file = request.files["image"]

        if file.filename == "":
            return jsonify({
                "success": False,
                "message": "Belum ada gambar yang dipilih."
            }), 400

        input_image = Image.open(file.stream).convert("RGBA")
        output_image = remove(input_image, session=session)

        output_buffer = BytesIO()
        output_image.save(output_buffer, format="PNG")
        output_buffer.seek(0)

        return send_file(
            output_buffer,
            mimetype="image/png",
            as_attachment=True,
            download_name="backdropai-hasil.png"
        )

    except Exception as error:
        app.logger.exception("Gagal menghapus latar belakang")
        return jsonify({
            "success": False,
            "message": "Gagal memproses gambar. Silakan coba gambar lain."
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

// Image preview when user selects a file
document.getElementById("postImage").addEventListener("change", function (e) {
  const file = e.target.files[0];
  const preview = document.getElementById("imagePreview");
  const previewImg = document.getElementById("previewImg");

  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      previewImg.src = event.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = "none";
  }
});

// Show loading state on form submit (upload can take a few seconds)
document.getElementById("newPostForm").addEventListener("submit", function () {
  const btn = document.getElementById("btnSubmitPost");
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Uploading…';
});

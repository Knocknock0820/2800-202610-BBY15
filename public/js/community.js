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

// Adopted from AI
// Modified by: Harun Yaprak
// Handle Like Button Clicks
document.querySelectorAll(".btn-like").forEach((btn) => {
  btn.addEventListener("click", async function () {
    const postId = this.getAttribute("data-post-id");
    if (!postId) return;

    // Optional: Optimistic UI update could go here, but waiting for server is safer
    try {
      const res = await fetch(`/community/like/${postId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle like");

      const data = await res.json();

      // Update UI
      const countSpan = this.querySelector(".like-count");
      if (countSpan) countSpan.textContent = data.likesCount;

      if (data.likedByUser) {
        this.classList.remove("btn-outline-sprout");
        this.classList.add("btn-sprout-liked");
      } else {
        this.classList.remove("btn-sprout-liked");
        this.classList.add("btn-outline-sprout");
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  });
});

// Handle Post Image Clicks for Preview Modal
document.querySelectorAll(".post-image-clickable").forEach((img) => {
  img.addEventListener("click", function () {
    const imageUrl = this.getAttribute("data-image-url");
    const author = this.getAttribute("data-author");
    const caption = this.getAttribute("data-caption");

    document.getElementById("previewModalImg").src = imageUrl;
    document.getElementById("previewModalAuthor").textContent = author;
    document.getElementById("previewModalCaption").textContent = caption;

    const modal = new bootstrap.Modal(
      document.getElementById("postPreviewModal"),
    );
    modal.show();
  });
});

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

// ==========================================
// EVENT DELEGATION FOR COMMUNITY POST CLICKS
// ==========================================

/*
  This code adopted from AI and mixed online resources for event delegation.
  Modified by: Harun Yaprak

  This code uses event delegation to handle clicks on like buttons and post images within the community posts container. 
  It allows for dynamic loading of posts while ensuring that event listeners work for newly added content without needing to reattach them.
*/
const postsContainer = document.getElementById("communityPosts");

if (postsContainer) {
  // Handle Like Button Clicks (Event Delegation)
  postsContainer.addEventListener("click", async function (e) {
    const btn = e.target.closest(".btn-like");
    if (!btn) return;

    const postId = btn.getAttribute("data-post-id");
    if (!postId) return;

    try {
      const res = await fetch(`/community/like/${postId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle like");

      const data = await res.json();

      // Update UI
      const countSpan = btn.querySelector(".like-count");
      if (countSpan) countSpan.textContent = data.likesCount;

      if (data.likedByUser) {
        btn.classList.remove("btn-outline-sprout");
        btn.classList.add("btn-sprout-liked");
      } else {
        btn.classList.remove("btn-sprout-liked");
        btn.classList.add("btn-outline-sprout");
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  });

  // Handle Post Image Clicks for Preview Modal (Event Delegation)
  postsContainer.addEventListener("click", function (e) {
    const img = e.target.closest(".post-image-clickable");
    if (!img) return;

    const imageUrl = img.getAttribute("data-image-url");
    const author = img.getAttribute("data-author");
    const caption = img.getAttribute("data-caption");

    document.getElementById("previewModalImg").src = imageUrl;
    document.getElementById("previewModalAuthor").textContent = author;
    document.getElementById("previewModalCaption").textContent = caption;

    const modal = new bootstrap.Modal(
      document.getElementById("postPreviewModal"),
    );
    modal.show();
  });
}

// ==========================================
// INFINITE SCROLL IMPLEMENTATION
// ==========================================

/*
  This code adopted from COMP 2537 lecture materials, and got help from AI for database fetching and dynamic loading logic.
  Modified by: Harun Yaprak

  This code implements infinite scrolling for the community posts page. 
  It listens to scroll events and loads more posts when the user nears the bottom of the page. 
  It also manages loading state and handles the case when there are no more posts to load.
*/
let isLoading = false;
let hasMore = true;
const limit = 5;

// Calculates relative time for dynamic posts
function getRelativeTime(createdAtString) {
  const now = new Date();
  const posted = new Date(createdAtString);
  const diffMs = now - posted;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return diffMins + " min ago";
  if (diffHours < 24)
    return diffHours + (diffHours === 1 ? " hour ago" : " hours ago");
  if (diffDays < 7)
    return diffDays + (diffDays === 1 ? " day ago" : " days ago");
  return posted.toLocaleDateString();
}

// Calculates the user's distance to the end of the page
function getDistanceToBottom() {
  const scrollHeight = document.documentElement.scrollHeight;
  const scrollTop =
    window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
  const clientHeight = window.innerHeight;
  return scrollHeight - scrollTop - clientHeight;
}

// Fetches more community posts and appends them
async function loadMorePosts() {
  if (isLoading || !hasMore || !postsContainer) return;

  const loadingIndicator = document.getElementById("loadingIndicator");
  const noMorePosts = document.getElementById("noMorePosts");
  const currentUsername = postsContainer.getAttribute("data-username") || "";

  // Count existing cards to calculate skip offset dynamically
  const skip = postsContainer.querySelectorAll(".community-card").length;

  isLoading = true;
  if (loadingIndicator) loadingIndicator.style.display = "block";

  try {
    const res = await fetch(`/api/community/posts?skip=${skip}&limit=${limit}`);
    if (!res.ok) throw new Error("Failed to load more posts");

    const data = await res.json();
    const posts = data.posts || [];

    if (posts.length < limit) {
      hasMore = false;
      if (noMorePosts) noMorePosts.style.display = "block";
    }

    if (posts.length > 0) {
      posts.forEach((post) => {
        const colDiv = document.createElement("div");
        colDiv.className = "col";

        // Image template if post contains an imageUrl
        let imgHtml = "";
        if (post.imageUrl) {
          imgHtml = `
            <img src="${post.imageUrl}" class="card-img-top post-image-clickable" alt="Community post photo" style="cursor: pointer;" data-image-url="${post.imageUrl}" data-author="${post.username}" data-caption="${post.caption || ""}" />
          `;
        }

        // Caption template
        const captionHtml = post.caption
          ? `<p class="card-text">${post.caption}</p>`
          : "";

        // Likes styling
        const likes = post.likes || [];
        const hasLiked = likes.includes(currentUsername);
        const btnClass = hasLiked ? "btn-sprout-liked" : "btn-outline-sprout";
        const relativeTime = getRelativeTime(post.createdAt);

        colDiv.innerHTML = `
          <div class="card community-card shadow-sm">
            ${imgHtml}
            <div class="card-body">
              <div class="d-flex align-items-center mb-2">
                <div class="post-avatar me-2">🌱</div>
                <div>
                  <strong class="post-author">${post.username}</strong>
                  <small class="text-muted d-block">${relativeTime}</small>
                </div>
              </div>
              ${captionHtml}
              <div class="d-flex justify-content-between align-items-center">
                <div class="btn-group">
                  <button type="button" class="btn btn-sm ${btnClass} btn-like" data-post-id="${post._id}">
                    ❤️ <span class="like-count">${likes.length}</span>
                  </button>
                </div>
                <small class="text-body-secondary">Community</small>
              </div>
            </div>
          </div>
        `;

        postsContainer.appendChild(colDiv);
      });
    }
  } catch (err) {
    console.error("Error loading more community posts:", err);
  } finally {
    isLoading = false;
    if (loadingIndicator) loadingIndicator.style.display = "none";
  }
}

// Listen to window scroll events to trigger infinite loading
window.addEventListener("scroll", function () {
  // If the user's distance to the end of the page is less than 250 pixels, fetch more
  if (getDistanceToBottom() < 250) {
    loadMorePosts();
  }
});

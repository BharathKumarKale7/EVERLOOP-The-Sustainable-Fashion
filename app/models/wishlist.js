document.addEventListener('DOMContentLoaded', function() {
    let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    const wishlistContainer = document.getElementById('wishlist-items');
    
    function renderWishlist() {
        wishlistContainer.innerHTML = '';
        wishlist.forEach(item => {
            let li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `${item} <button class='btn btn-danger btn-sm remove-item' data-item='${item}'>Remove</button>`;
            wishlistContainer.appendChild(li);
        });
    }
    
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('remove-item')) {
            const item = event.target.getAttribute('data-item');
            wishlist = wishlist.filter(w => w !== item);
            localStorage.setItem('wishlist', JSON.stringify(wishlist));
            renderWishlist();
        }
    });
    
    renderWishlist();
});
// Bọc mã trong hàm tức thì để các biến cấu hình không trở thành biến toàn cục và script có thể dùng trên mọi trang.
(() => {
    // Tên mục lưu tạm trong tab, dùng để trang tiếp theo biết cần chạy hiệu ứng xuất hiện.
    const destinationKey = "wefo-page-transition-destination";

    // Nếu trang vừa mở là đích của link cùng website, bật hiệu ứng xuất hiện một lần rồi xóa dấu ghi nhớ.
    try {
        if (sessionStorage.getItem(destinationKey) === window.location.href) {
            // Xóa cờ trước khi thêm class để refresh lại trang không phát lại transition ngoài ý muốn.
            sessionStorage.removeItem(destinationKey);
            document.documentElement.classList.add("page-enter");
        }
    } catch {}

    // Theo dõi click trên toàn trang để xử lý cả link đã có sẵn và link được thêm sau khi trang mở.
    document.addEventListener("click", (event) => {
        // Nếu người dùng bấm vào chữ hoặc biểu tượng trong link, tìm link chứa phần tử vừa bấm.
        const anchor = event.target instanceof Element
            ? event.target.closest("a[href]")
            : null;

        // Bỏ qua click chuột phải, mở tab mới, link tải tệp hoặc thao tác đã được phần khác xử lý.
        if (!anchor || event.defaultPrevented || event.button !== 0
            || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
            || (anchor.target && anchor.target.toLowerCase() !== "_self")
            || anchor.hasAttribute("download")) {
            return;
        }

        // Đổi địa chỉ link thành dạng đầy đủ để kiểm tra nó dẫn sang trang nào.
        const destination = new URL(anchor.href, window.location.href);
        // Không thêm hiệu ứng cho link sang website khác hoặc link chỉ tải lại đúng trang hiện tại.
        if (destination.origin !== window.location.origin
            || (destination.pathname === window.location.pathname
                && destination.search === window.location.search)) {
            return;
        }

        // Nếu người dùng bật giảm chuyển động, dùng hiệu ứng mờ ngắn; các trường hợp khác dùng hiệu ứng đầy đủ.
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const leaveDuration = reducedMotion ? 100 : 180;

        // Tạm dừng việc mở trang mới để hiệu ứng rời trang hiện tại kịp chạy xong.
        event.preventDefault();

        // Ghi nhớ trang sắp mở để trang đó chạy hiệu ứng xuất hiện; nếu không lưu được vẫn tiếp tục chuyển trang.
        try {
            sessionStorage.setItem(destinationKey, destination.href);
        } catch {}

        // Bật hiệu ứng rời trang rồi mở địa chỉ đích sau thời gian hiệu ứng kết thúc.
        document.documentElement.classList.add("page-leaving");
        window.setTimeout(() => window.location.assign(destination.href), leaveDuration);
    });
})();
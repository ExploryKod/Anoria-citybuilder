/**
 * Browser toast for disaster events.
 */
export class BrowserDisasterNotificationAdapter {
  /**
   * @param {object} event
   * @param {string} event.name
   * @param {string} event.description
   * @param {number} event.cost
   * @param {{ x: number, y: number }} house
   */
  show(event, house) {
    if (typeof document === 'undefined') {
      return;
    }

    const notification = document.createElement('div');
    notification.className = 'event-notification';
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;

    notification.innerHTML = `
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 10px;">
                ⚠️ ${event.name}
            </div>
            <div style="margin-bottom: 10px;">
                ${event.description}
            </div>
            <div style="font-size: 14px; opacity: 0.9;">
                Une maison a été détruite à (${house.x}, ${house.y})<br>
                Coût de réparation : ${event.cost}€
            </div>
        `;

    if (!document.getElementById('event-notification-style')) {
      const style = document.createElement('style');
      style.id = 'event-notification-style';
      style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        notification.parentNode?.removeChild(notification);
      }, 300);
    }, 5000);
  }
}

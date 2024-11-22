// Content script to extract page content
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === "getContent") {
    try {
      // Get the main content of the page
      const mainContent = document.body.innerText || document.body.textContent;
      
      // Clean up the content
      const cleanContent = mainContent
        .replace(/[\r\n]+/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
        .trim();                  // Remove leading/trailing whitespace
      
      console.log('Content extracted, length:', cleanContent.length);
      
      // Send response back to popup
      sendResponse({
        content: cleanContent,
        success: true
      });
    } catch (error) {
      console.error('Error getting content:', error);
      sendResponse({
        error: error.message,
        success: false
      });
    }
  }
  
  // This return true is required for async response in Firefox
  return true;
});

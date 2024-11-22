browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === "getContent") {
    try {
      const mainContent = document.body.innerText || document.body.textContent;
      
      const cleanContent = mainContent
        .replace(/[\r\n]+/g, ' ') 
        .replace(/\s+/g, ' ')     
        .trim();                  
      
      console.log('Content extracted, length:', cleanContent.length);
      
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
  
  return true;
});

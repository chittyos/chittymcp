/**
 * ChittyOS Workspace Proxy
 * Deploy as a Web App: Execute as "Me", Access "Anyone"
 */

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    let result;
    
    switch (action) {
      case 'move_file':
        result = moveFile(payload.fileId, payload.destinationFolderId);
        break;
      case 'export_pdf':
        result = exportToPdf(payload.fileId, payload.destinationFolderId);
        break;
      case 'get_attachment':
        result = getAttachment(payload.messageId);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      result: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function moveFile(fileId, destFolderId) {
  const file = DriveApp.getFileById(fileId);
  const destFolder = DriveApp.getFolderById(destFolderId);
  
  const parents = file.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    parent.removeFile(file);
  }
  destFolder.addFile(file);
  
  return {
    fileId: file.getId(),
    newParentId: destFolderId
  };
}

function exportToPdf(fileId, destFolderId) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getAs(MimeType.PDF);
  const destFolder = DriveApp.getFolderById(destFolderId);
  const newPdf = destFolder.createFile(blob);
  
  return {
    originalId: fileId,
    pdfId: newPdf.getId(),
    pdfUrl: newPdf.getUrl()
  };
}

function getAttachment(messageId) {
  const message = GmailApp.getMessageById(messageId);
  const attachments = message.getAttachments();
  
  return attachments.map(att => ({
    name: att.getName(),
    contentType: att.getContentType(),
    size: att.getSize(),
    isInline: att.isInline()
  }));
}

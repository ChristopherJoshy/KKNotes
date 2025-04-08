// Admin panel JavaScript for KKNotes

// DOM Elements
const semesterItems = document.querySelectorAll('.semester-item');
const currentSemTitle = document.getElementById('current-sem-title');
const adminNotesList = document.getElementById('admin-notes-list');
const addNoteForm = document.getElementById('add-note-form');

// Current selected semester in admin panel
let currentAdminSemester = 's1'; // Default to S1

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeAdmin);
semesterItems.forEach(item => item.addEventListener('click', handleAdminSemesterChange));
if (addNoteForm) addNoteForm.addEventListener('submit', handleAddNote);

/**
 * Initialize the admin panel
 */
function initializeAdmin() {
    // Check if user is authenticated first
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) return;
    
    // Load notes for default semester (S1)
    loadAdminNotes(currentAdminSemester);
}

/**
 * Load notes for admin view
 * @param {string} semester - The semester code (s1, s2, etc.)
 */
function loadAdminNotes(semester) {
    // Show loading spinner
    adminNotesList.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading notes...</p>
        </div>
    `;
    
    // Update title
    currentSemTitle.textContent = `Semester ${semester.substring(1)} Notes`;
    
    // Set a timeout to detect long-running requests
    const timeoutId = setTimeout(() => {
        console.warn('Firebase admin request taking longer than expected, possible connection issues');
        // Try to recover silently
        try {
            database.goOffline();
            setTimeout(() => database.goOnline(), 1000);
        } catch (e) {
            console.error('Failed to reconnect Firebase:', e);
        }
    }, 6000);
    
    // Get notes from Firebase
    database.ref(`notes/${semester}`).once('value')
        .then(snapshot => {
            clearTimeout(timeoutId);
            const notes = snapshot.val();
            console.log(`Admin: loaded notes for ${semester}`, notes ? Object.keys(notes).length : 0, 'entries');
            displayAdminNotes(notes, semester);
        })
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('Error loading notes for admin:', error);
            displayAdminError();
            
            // Add a retry button
            const retryBtn = document.createElement('button');
            retryBtn.className = 'btn primary-btn mt-3';
            retryBtn.textContent = 'Retry';
            retryBtn.addEventListener('click', () => loadAdminNotes(semester));
            adminNotesList.appendChild(retryBtn);
        });
}

/**
 * Display notes in admin panel
 * @param {Object} notes - The notes object from Firebase
 * @param {string} semester - The current semester code
 */
function displayAdminNotes(notes, semester) {
    adminNotesList.innerHTML = '';
    
    if (!notes || Object.keys(notes).length === 0) {
        displayAdminEmptyState();
        return;
    }
    
    // Add each note as an editable item
    Object.keys(notes).forEach(key => {
        const note = notes[key];
        const noteItem = createAdminNoteItem(note, key, semester);
        adminNotesList.appendChild(noteItem);
    });
}

/**
 * Create an admin note item element
 * @param {Object} note - The note object
 * @param {string} noteId - The note ID in Firebase
 * @param {string} semester - The semester code
 * @returns {HTMLElement} - The admin note item element
 */
function createAdminNoteItem(note, noteId, semester) {
    const item = document.createElement('div');
    item.className = 'admin-note-item';
    item.dataset.id = noteId;
    
    item.innerHTML = `
        <div class="note-info">
            <h4 class="note-title">${note.title}</h4>
            <p class="note-link">${note.link}</p>
        </div>
        <div class="note-actions">
            <button class="action-btn edit-btn" title="Edit Note">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete-btn" title="Delete Note">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
    
    // Add event listeners for edit and delete buttons
    const editBtn = item.querySelector('.edit-btn');
    const deleteBtn = item.querySelector('.delete-btn');
    
    editBtn.addEventListener('click', () => openEditModal(note, noteId, semester));
    deleteBtn.addEventListener('click', () => confirmDeleteNote(noteId, semester));
    
    return item;
}

/**
 * Display empty state in admin panel
 */
function displayAdminEmptyState() {
    adminNotesList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-file-alt" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <h3>No notes found</h3>
            <p>There are no notes available for this semester yet.</p>
            <p>Use the form below to add a new note.</p>
        </div>
    `;
}

/**
 * Display error state in admin panel
 */
function displayAdminError() {
    adminNotesList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: var(--warning-color);"></i>
            <h3>Failed to load notes</h3>
            <p>There was a problem loading the notes. Please try again later.</p>
        </div>
    `;
}

/**
 * Handle admin semester change
 * @param {Event} event - The click event
 */
function handleAdminSemesterChange(event) {
    const semester = event.target.dataset.sem;
    
    // Update active item
    semesterItems.forEach(item => item.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update current semester and load notes
    currentAdminSemester = semester;
    loadAdminNotes(semester);
}

/**
 * Handle add note form submission
 * @param {Event} event - The form submission event
 */
function handleAddNote(event) {
    event.preventDefault();
    
    const title = document.getElementById('note-title').value.trim();
    const link = document.getElementById('note-link').value.trim();
    
    // Simple validation
    if (!title || !link) {
        alert('Please enter both title and link');
        return;
    }
    
    // Check if link is a valid URL
    try {
        new URL(link);
    } catch (e) {
        alert('Please enter a valid URL');
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('#add-note-form button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;
    
    // Show status
    const uploadStatus = document.getElementById('upload-status');
    const statusMessage = uploadStatus.querySelector('.status-message');
    const loadingIcon = uploadStatus.querySelector('.status-loading');
    const successIcon = uploadStatus.querySelector('.status-success');
    const errorIcon = uploadStatus.querySelector('.status-error');
    
    // Set initial status
    uploadStatus.classList.remove('hidden');
    loadingIcon.classList.remove('hidden');
    successIcon.classList.add('hidden');
    errorIcon.classList.add('hidden');
    statusMessage.textContent = 'Uploading note to Firebase...';
    
    // Save to Firebase
    const newNoteRef = database.ref(`notes/${currentAdminSemester}`).push();
    
    newNoteRef.set({
        title: title,
        link: link,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    })
    .then(() => {
        // Reset form
        addNoteForm.reset();
        
        // Update status
        loadingIcon.classList.add('hidden');
        successIcon.classList.remove('hidden');
        statusMessage.textContent = 'Note added successfully!';
        
        // Reset button
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
        
        // Hide status after delay
        setTimeout(() => {
            uploadStatus.classList.add('hidden');
        }, 3000);
        
        // Reload notes
        loadAdminNotes(currentAdminSemester);
    })
    .catch(error => {
        console.error('Error adding note:', error);
        
        // Update status
        loadingIcon.classList.add('hidden');
        errorIcon.classList.remove('hidden');
        statusMessage.textContent = 'Error: ' + error.message;
        
        // Reset button
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
        
        // Hide status after delay
        setTimeout(() => {
            uploadStatus.classList.add('hidden');
        }, 5000);
    });
}

/**
 * Open modal to edit a note
 * @param {Object} note - The note object
 * @param {string} noteId - The note ID in Firebase
 * @param {string} semester - The semester code
 */
function openEditModal(note, noteId, semester) {
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Edit Note</h3>
                <button class="close-modal">&times;</button>
            </div>
            <form id="edit-note-form" class="admin-form">
                <div class="form-group">
                    <label for="edit-note-title">Title</label>
                    <input type="text" id="edit-note-title" name="edit-note-title" value="${note.title}" required>
                </div>
                <div class="form-group">
                    <label for="edit-note-link">Google Drive Link</label>
                    <input type="url" id="edit-note-link" name="edit-note-link" value="${note.link}" required>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn outline-btn cancel-btn">Cancel</button>
                    <button type="submit" class="btn primary-btn">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    
    // Add modal to document
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeBtn = modal.querySelector('.close-modal');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const form = modal.querySelector('#edit-note-form');
    
    closeBtn.addEventListener('click', () => document.body.removeChild(modal));
    cancelBtn.addEventListener('click', () => document.body.removeChild(modal));
    
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const newTitle = document.getElementById('edit-note-title').value.trim();
        const newLink = document.getElementById('edit-note-link').value.trim();
        
        // Simple validation
        if (!newTitle || !newLink) {
            alert('Please enter both title and link');
            return;
        }
        
        // Check if link is a valid URL
        try {
            new URL(newLink);
        } catch (e) {
            alert('Please enter a valid URL');
            return;
        }
        
        // Update in Firebase
        database.ref(`notes/${semester}/${noteId}`).update({
            title: newTitle,
            link: newLink
        })
        .then(() => {
            // Remove modal
            document.body.removeChild(modal);
            
            // Reload notes
            loadAdminNotes(semester);
        })
        .catch(error => {
            console.error('Error updating note:', error);
            alert('Error updating note. Please try again.');
        });
    });
}

/**
 * Confirm and delete a note
 * @param {string} noteId - The note ID in Firebase
 * @param {string} semester - The semester code
 */
function confirmDeleteNote(noteId, semester) {
    if (confirm('Are you sure you want to delete this note?')) {
        // Delete from Firebase
        database.ref(`notes/${semester}/${noteId}`).remove()
            .then(() => {
                // Reload notes
                loadAdminNotes(semester);
            })
            .catch(error => {
                console.error('Error deleting note:', error);
                alert('Error deleting note. Please try again.');
            });
    }
}

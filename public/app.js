const form = document.getElementById('boxForm');
const boxList = document.getElementById('boxGrid');
const searchInput = document.getElementById('search');
const feedback = document.getElementById('feedback');
let isEditing = false;
let currentEditId = null;

function getToken() {
  return localStorage.getItem('token');
}

async function loadBoxes(query = '') {
  try {
    const token = getToken();
    if (!token) throw new Error('Not authenticated. Please log in.');

    const res = await fetch('/api/boxes', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error('Failed to fetch boxes');
    const boxes = await res.json();

    const filteredBoxes = query
      ? boxes.filter(box =>
          box.label.text.toLowerCase().includes(query.toLowerCase()) ||
          box.destination.toLowerCase().includes(query.toLowerCase())
        )
      : boxes;

    boxList.innerHTML = '';
    filteredBoxes.forEach(box => {
      const parent = document.createElement('div');
      parent.className = 'parent';
    
      // Div1: Image
      const div1 = document.createElement('div');
      div1.className = 'div1';
      if (box.photo) {
        const img = document.createElement('img');
        img.src = `uploads/${box.photo}`;
        img.alt = 'Box photo';
        img.style.width = '100%';
        img.style.borderRadius = '6px';
        div1.appendChild(img);
      }
      parent.appendChild(div1);
    
      // Div2: Box ID + label
      const div2 = document.createElement('div');
      div2.className = 'div2';
      div2.innerHTML = `
        <strong>Box ID:</strong> ${box.id}<br>
        <strong>Label:</strong> ${box.label.color} - "${box.label.text}"`;
      parent.appendChild(div2);
    
      // Div3: Items
      const div3 = document.createElement('div');
      div3.className = 'div3';
      div3.innerHTML = `<strong>Items:</strong><br>${box.items.join(', ')}`;
      parent.appendChild(div3);
    
      // Div4: Destination
      const div4 = document.createElement('div');
      div4.className = 'div4';
      div4.innerHTML = `<strong>Destination:</strong><br>${box.destination}`;
      parent.appendChild(div4);
    
      // Action buttons container
      const actions = document.createElement('div');
      actions.className = 'box-actions';
      const editBtn = document.createElement('button');
      editBtn.innerHTML = '🖉';
      editBtn.onclick = () => editBox(box.id);
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '❌';
      deleteBtn.onclick = () => deleteBox(box.id);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      parent.appendChild(actions);
    
      boxList.appendChild(parent);
    });
    
  } catch (err) {
    feedback.textContent = `Error: ${err.message}`;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  feedback.textContent = '';
  try {
    const token = getToken();
    if (!token) throw new Error('Not authenticated. Please log in.');

    const fileInput = document.getElementById('photo');
    let photoFilename = '';

    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('photo', fileInput.files[0]);

      const uploadRes = await fetch('http://157.230.4.1:3000/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) throw new Error('File upload failed');
      const uploadData = await uploadRes.json();
      photoFilename = uploadData.filename;
    }

    const box = {
      label: {
        color: document.getElementById('labelColor').value,
        text: document.getElementById('labelText').value
      },
      items: document.getElementById('items').value.split(',').map(i => i.trim()).filter(i => i),
      destination: document.getElementById('destination').value,
      photo: photoFilename
    };

    if (!box.label.text || !box.destination || !box.items.length) {
      throw new Error('All fields except photo are required');
    }

    const url = isEditing ? `/api/boxes/${currentEditId}` : '/api/boxes';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(box)
    });

    if (!res.ok) throw new Error('Failed to save box');

    if (isEditing) {
      isEditing = false;
      currentEditId = null;
      form.querySelector('button').textContent = 'Add Box';
      document.getElementById('photoPreview').innerHTML = '';
    }

    form.reset();
    loadBoxes();
    feedback.textContent = 'Box saved successfully!';
  } catch (err) {
    feedback.textContent = `Error: ${err.message}`;
  }
});

window.editBox = async function(id) {
  try {
    const token = getToken();
    if (!token) throw new Error('Not authenticated. Please log in.');

    const res = await fetch('/api/boxes', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error('Failed to fetch boxes');
    const boxes = await res.json();
    const box = boxes.find(b => b.id === id);
    if (!box) throw new Error('Box not found');

    document.getElementById('labelColor').value = box.label.color;
    document.getElementById('labelText').value = box.label.text;
    document.getElementById('items').value = box.items.join(', ');
    document.getElementById('destination').value = box.destination;
    document.getElementById('photoPreview').innerHTML = box.photo
      ? `<img src="uploads/${box.photo}" width="150" alt="Current photo">`
      : '';

    isEditing = true;
    currentEditId = id;
    form.querySelector('button').textContent = 'Update Box';
  } catch (err) {
    feedback.textContent = `Error: ${err.message}`;
  }
};

window.deleteBox = async function(id) {
  try {
    const token = getToken();
    if (!token) throw new Error('Not authenticated. Please log in.');

    const res = await fetch(`/api/boxes/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error('Failed to delete box');
    loadBoxes();
    feedback.textContent = 'Box deleted successfully!';
  } catch (err) {
    feedback.textContent = `Error: ${err.message}`;
  }
};

searchInput.addEventListener('input', () => loadBoxes(searchInput.value));

// Optional redirect if not logged in
if (!getToken()) {
  window.location.href = '/login.html';
}

loadBoxes();

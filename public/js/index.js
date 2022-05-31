import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { login, signup, logout } from './login.js';
import { displayMap } from './mapbox.js';
import { updateSettings } from './updateSettings.js';
import { bookTour } from './stripe';
import { showAlert } from './alerts.js';

const mapBox = document.getElementById('map');
const loginForm = document.querySelector('.login-form > .form');
const signupForm = document.querySelector('.signup-form > .form');
const logOutBtn = document.querySelector('.nav__el--logout');
const userDataForm = document.querySelector('.form-user-data');
const userPasswordForm = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour');
const dateOption = document.getElementById('date');

if (mapBox) {
  const locations = JSON.parse(mapBox.dataset.locations);
  displayMap(locations);
}

if (loginForm) {
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    login(new FormData(this));
  });
}

if (signupForm) {
  signupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    signup(new FormData(this));
  });
}

if (logOutBtn) {
  logOutBtn.addEventListener('click', logout);
}

if (userDataForm) {
  userDataForm.addEventListener('submit', function (e) {
    e.preventDefault();
    updateSettings(new FormData(this), 'data');
  });
}

if (userPasswordForm) {
  userPasswordForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    document.querySelector('.btn--save-password').textContent = 'Updating...';
    const currentPassword = document.getElementById('password-current').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    await updateSettings(
      { currentPassword, password, passwordConfirm },
      'password'
    );
    document.querySelector('.btn--save-password').textContent = 'SAVE password';
    this.reset();
  });
}

if (bookBtn && dateOption) {
  bookBtn.addEventListener('click', function (e) {
    const btnText = this.textContent;
    this.textContent = 'Processing...';

    const tourId = dateOption.dataset.tourId;
    const dateId = dateOption.value;
    if (!dateId) {
      this.textContent = btnText;
      return showAlert('error', 'Please select a start date');
    }
    bookTour(tourId, dateId);
  });
}

const alertMessage = document.querySelector('body').dataset.alert;
if (alertMessage) showAlert('success', alertMessage, 20);

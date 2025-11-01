/* eslint-env browser */
/* global Package */
import './login.html';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { pushAlert } from '/imports/ui/blaze/layout';

// Ensure Google OAuth package is loaded
if (Meteor.isClient) {
	// Try to load accounts-google if not already loaded
	// The package should be automatically available
	if (typeof Package !== 'undefined' && Package['accounts-google']) {
		console.log('✅ accounts-google package is loaded');
	} else {
		console.warn('⚠️ accounts-google package not found');
	}
}

// Check if Google OAuth is available
const isGoogleAvailable = () => {
	const available = typeof Meteor.loginWithGoogle === 'function';
	if (!available) {
		console.log('Available Meteor methods:', Object.keys(Meteor).filter(k => k.startsWith('login')));
	}
	return available;
};

Template.Login.onCreated(function () {
	this.showingSignup = new ReactiveVar(false);
	this.processing = new ReactiveVar(false);

	// Debug: Log Google OAuth availability
	console.log('Google OAuth available:', isGoogleAvailable());
	console.log('Meteor.loginWithGoogle:', typeof Meteor.loginWithGoogle);

	// Redirect if already logged in
	this.autorun(() => {
		if (Meteor.userId()) {
			FlowRouter.go('/');
		}
	});
});

Template.Login.helpers({
	showingSignup() {
		return Template.instance().showingSignup.get();
	},
	googleAvailable() {
		return isGoogleAvailable();
	},
});

Template.Login.events({
	'click #showSignupBtn'(e, tpl) {
		e.preventDefault();
		tpl.showingSignup.set(true);
	},

	'click #showLoginBtn'(e, tpl) {
		e.preventDefault();
		tpl.showingSignup.set(false);
	},

	// Google Login Button
	'click #googleLoginBtn'(event) {
		event.preventDefault();
		console.log('🔵 Google login button clicked');
		console.log('Event:', event);
		console.log('Button element:', event.currentTarget);

		if (!isGoogleAvailable()) {
			console.error('❌ Google OAuth not available');
			pushAlert('Google Sign-In is not available. Please contact support.', 'error');
			return;
		}

		try {
			console.log('✅ Calling Meteor.loginWithGoogle...');
			Meteor.loginWithGoogle({
				requestPermissions: ['email', 'profile'],
				loginStyle: 'popup',
			}, (error) => {
				if (error) {
					console.error('❌ Google login error:', error);
					pushAlert(error.message || 'Google Sign-In failed. Please try again.', 'error');
				} else {
					console.log('✅ Google login successful');
					FlowRouter.go('/');
				}
			});
		} catch (err) {
			console.error('❌ Exception during Google login:', err);
			pushAlert('An error occurred during Google Sign-In. Please try again.', 'error');
		}
	},

	'click #googleSignupBtn'(e, tpl) {
		e.preventDefault();
		console.log('🔵 Google signup button clicked');
		console.log('Event:', e);
		console.log('Button element:', e.currentTarget);

		if (tpl.processing.get()) {return;}

		// Check if Google OAuth is available
		if (!isGoogleAvailable()) {
			console.error('❌ Meteor.loginWithGoogle is not available');
			pushAlert('error', 'Google sign-up is not available. Please configure Google OAuth credentials.');
			return;
		}

		tpl.processing.set(true);
		const btn = e.currentTarget;
		btn.disabled = true;
		btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span><span>Signing up...</span>';

		try {
			console.log('✅ Calling Meteor.loginWithGoogle...');
			Meteor.loginWithGoogle(
				{
					requestPermissions: ['email', 'profile'],
					loginStyle: 'popup',
				},
				(error) => {
					tpl.processing.set(false);
					btn.disabled = false;
					btn.innerHTML = '<i class="bi bi-google"></i><span>Continue with Google</span>';

					if (error) {
						console.error('❌ Google signup error:', error);
						if (error.message === 'Popup was closed by the user' || error.error === 'popup-closed') {
							pushAlert('info', 'Google sign-up cancelled');
						} else {
							pushAlert('error', error.reason || error.message || 'Google sign-up failed');
						}
					} else {
						console.log('✅ Google signup successful');
						pushAlert('success', 'Account created! Welcome to Splitly!');
						FlowRouter.go('/');
					}
				},
			);
		} catch (err) {
			tpl.processing.set(false);
			btn.disabled = false;
			btn.innerHTML = '<i class="bi bi-google"></i><span>Continue with Google</span>';
			console.error('❌ Exception during Google signup:', err);
			pushAlert('error', 'Failed to initiate Google sign-up');
		}
	},

	async 'submit #loginForm'(e, tpl) {
		e.preventDefault();
		if (tpl.processing.get()) {return;}

		const email = tpl.find('#loginEmail').value.trim();
		const password = tpl.find('#loginPassword').value;

		if (!email || !password) {
			pushAlert('error', 'Please enter both email and password');
			return;
		}

		tpl.processing.set(true);
		const loginBtn = tpl.find('#loginBtn');
		if (loginBtn) {
			loginBtn.disabled = true;
			loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span><span>Signing in...</span>';
		}

		Meteor.loginWithPassword(email, password, (error) => {
			tpl.processing.set(false);
			if (loginBtn) {
				loginBtn.disabled = false;
				loginBtn.innerHTML = 'Sign in';
			}

			if (error) {
				pushAlert('error', error.reason || 'Login failed');
			} else {
				pushAlert('success', 'Welcome back!');
				FlowRouter.go('/');
			}
		});
	},

	async 'submit #signupForm'(e, tpl) {
		e.preventDefault();
		if (tpl.processing.get()) {return;}

		const email = tpl.find('#signupEmail').value.trim();
		const password = tpl.find('#signupPassword').value;
		const passwordConfirm = tpl.find('#signupPasswordConfirm').value;
		const displayName = tpl.find('#signupDisplayName').value.trim();

		if (!email || !password) {
			pushAlert('error', 'Please fill in all required fields');
			return;
		}

		if (password.length < 8) {
			pushAlert('error', 'Password must be at least 8 characters');
			return;
		}

		if (password !== passwordConfirm) {
			pushAlert('error', 'Passwords do not match');
			return;
		}

		tpl.processing.set(true);
		const signupBtn = tpl.find('#signupBtn');
		if (signupBtn) {
			signupBtn.disabled = true;
			signupBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span><span>Creating account...</span>';
		}

		const options = {
			email,
			password,
			profile: {
				displayName: displayName || email.split('@')[0],
			},
		};

		Accounts.createUser(options, (error) => {
			tpl.processing.set(false);
			if (signupBtn) {
				signupBtn.disabled = false;
				signupBtn.innerHTML = 'Create account';
			}

			if (error) {
				pushAlert('error', error.reason || 'Signup failed');
			} else {
				pushAlert('success', 'Account created! Welcome to Splitly!');
				FlowRouter.go('/');
			}
		});
	},

	'click #guestLoginBtn'(e, tpl) {
		e.preventDefault();
		if (tpl.processing.get()) {return;}

		// Generate a unique guest email
		const guestId = Math.random().toString(36).substring(2, 15);
		const guestEmail = `guest_${guestId}@splitly.app`;
		const guestPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

		tpl.processing.set(true);
		const btn = e.currentTarget;
		btn.disabled = true;
		btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span><span>Logging in...</span>';

		// Create guest account automatically
		Accounts.createUser({
			email: guestEmail,
			password: guestPassword,
			profile: {
				displayName: 'Guest', // Simple "Guest" name
				isGuest: true, // Flag to identify guest accounts
			},
		}, (error) => {
			tpl.processing.set(false);
			btn.disabled = false;
			btn.innerHTML = '<i class="bi bi-incognito"></i><span>Continue as guest</span>';

			if (error) {
				pushAlert('error', error.reason || 'Failed to create guest session');
			} else {
				pushAlert('info', 'Welcome! You\'re using a temporary guest account');
				FlowRouter.go('/');
			}
		});
	},
});

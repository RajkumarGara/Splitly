import { Meteor } from 'meteor/meteor';
import { Bills } from './bills';
import { GlobalUsers } from './users';

Meteor.publish('bills.all', function() {
	// Only publish bills owned by the current user
	if (!this.userId) {
		return this.ready();
	}

	return Bills.find({ userId: this.userId });
});

Meteor.publish('globalUsers.all', function() {
	// Global users are shared, but could be filtered by user if needed
	return GlobalUsers.find({});
});

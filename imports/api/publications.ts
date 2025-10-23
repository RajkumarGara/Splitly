import { Meteor } from 'meteor/meteor';
import { Bills } from './bills';
import { GlobalUsers } from './users';

Meteor.publish('bills.all', function() {
	return Bills.find({});
});

Meteor.publish('globalUsers.all', function() {
	return GlobalUsers.find({});
});

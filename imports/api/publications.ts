import { Meteor } from 'meteor/meteor';
import { Bills } from './bills';
import { GlobalUsers } from './users';

Meteor.publish('bills.all', function() {
	console.log('📡 bills.all publication called');
	const cursor = Bills.find({});
	const count = cursor.count();
	console.log('📊 Publishing', count, 'bills');
	return cursor;
});

Meteor.publish('globalUsers.all', function() {
	return GlobalUsers.find({});
});

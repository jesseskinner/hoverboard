var chai = require('chai');
var expect = chai.expect;
var Hoverboard = require('../src/index');

describe('hoverboard', function () {

	describe('#init', function () {

		it('should return a function when passed an object', function () {
			expect(Hoverboard({})).to.be.a('function');
		});

		it('should create actions from an object', function () {
			var store = Hoverboard({
				something: function(){}
			});

			expect(store.something).to.be.a('function');
		});

		it('should create actions from a class', function () {
			var myClass = function(){};
			myClass.prototype.something = function(){};

			var store = Hoverboard(new myClass);

			expect(store.something).to.be.a('function');
		});

		it('should create actions from an extended class', function () {
			var ParentClass = function(){};
			ParentClass.prototype.something = function(){};

			var ChildClass = function(){};
			ChildClass.prototype = new ParentClass();

			var store = Hoverboard(new ChildClass);

			expect(store.something).to.be.a('function');
		});

		it('should create actions from a module', function () {
			function Module(){
				return {
					test: function(){}
				};
			};

			var store = Hoverboard(new Module);

			expect(store.test).to.be.a('function');
		});

		it('should not add anything to the original prototype', function () {
			var myClass = function(){};
			var store = Hoverboard(myClass);

			expect(myClass.prototype).to.be.empty;
		});

		it('should not add anything to the original object', function () {
			var obj = {};
			var store = Hoverboard(obj);

			expect(obj).to.be.empty;
		});
	});

	describe('#state', function () {
		it('should return undefined by default', function () {
			expect(Hoverboard({})()).to.be.undefined;
		});

		it('should not discard mutations between action handlers', function () {
			var store = Hoverboard({
				foo: function (state) {
					return { test: true };
				},
				bar: function (state) {
					expect(state.test).to.be.true;
				}
			});

			store.foo();
			store.bar();
		});

		it('should not return a different class instance after each action call', function () {
			var myClass = function(){};
			var instance = new myClass();

			var store = Hoverboard({
				reset: function () {
					return instance;
				},
				ping: function (state) {
					return state;
				}
			});

			store.reset();
			store.ping();

			expect(store() === instance).to.be.true;
		});

		it('should return a different object after each action call', function () {
			var store = Hoverboard({
				reset: function () {
					return { value: 0 };
				},
				add: function (state, num) {
					return {
						value: state.value + num
					};
				}
			});

			store.reset();

			store.add(2);
			var result1 = store();

			store.add(3);
			var result2 = store();

			expect(result1.value).to.equal(2);
			expect(result2.value).to.equal(5);
			expect(result1).not.to.equal(result2);
		});

		it('should not prevent mutation of state passed to action', function () {
			var store = Hoverboard({
				init: function () {
					return { value: 'yay' };
				},
				mutate: function (state) {
					state.value = 'boo';
					return state;
				}
			});

			store.init();
			store.mutate();

			expect(store().value).to.equal('boo');
		});

		it('should not prevent mutation of state passed to subscriber', function () {
			var store = Hoverboard({
				action: function () {
					return { value: 'yay' };
				}
			});

			store.action();

			store(function (state) {
				state.value = 'boo';
			});

			expect(store().value).to.equal('boo');
		});

		it('should not be able to cause infinite loop', function () {
			var store = Hoverboard({
				action: function () {
					store.action();
				}
			});

			expect(store.action).to.throw(Error, /^Hoverboard: Cannot call action in the middle of an action$/);
		});
	});

	describe('#action()', function () {

		it('should call an action handler', function (done) {
			var store = Hoverboard({
				action: function () {
					done();
				}
			});

			store.action();
		});

		it('should still work with zero, one, two, three or four arguments', function () {
			var store = Hoverboard({
				action: function (state, arg1, arg2, arg3, arg4) {
					return { len: arguments.length - 1 };
				}
			});

			store.action();
			expect(store().len).to.equal(0);

			store.action(1);
			expect(store().len).to.equal(1);

			store.action(1,2);
			expect(store().len).to.equal(2);

			store.action(1,2,3);
			expect(store().len).to.equal(3);

			store.action(1,2,3,4);
			expect(store().len).to.equal(4);
		});

		it('should return state', function () {
			var store = Hoverboard({
				add: function (state, num) {
					return (state || 0) + num;
				}
			});

			expect(store.add(4)).to.equal(4);
			expect(store.add(2)).to.equal(6);
		});

	});

	describe('#getState(function)', function () {

		it('should allow state listeners on stores', function (done) {
			var store = Hoverboard({
				update: function (state, newState) {
					return newState;
				}
			});

			store(function (state) {
				if (state === 123) {
					done();
				}
			});

			store.update(123);
		});

		it('should return an unsubscribe function', function (done) {
			var store = Hoverboard({
					update: function (state, data) {
						return data;
					}
				}),

				unsubscribe = store(function (state) {
					if (state === 1) {
						throw "I should not be called";
					}
				});

			store.getState(function (state) {
				// this should be called
				if (state === 1) {
					done();
				}
			});

			// unsubscribe the first one
			unsubscribe();

			// second time does nothing
			unsubscribe();

			// trigger an update
			store.update(1);
		});

		it('should unsubscribe without breaking other listeners', function () {
			var store = Hoverboard({
					update: function (state, data) {
						return data;
					}
				}),

				success = false,

				unsubscribe = store.getState(function (state) {
					if (state === 1) {
						unsubscribe();
					}
				});

			store(function (state) {
				if (state === 1) {
					success = true;
				}
			});

			// trigger an update
			store.update(1);

			expect(success).to.be.true;
		});

		it('should prevent actions to be called from listeners', function () {
			var store = Hoverboard({
				foo: function () {
					return 1;
				}
			});

			expect(function () {
				store(function () {
					store.foo();
				});
			}).to.throw(Error, /^Hoverboard: Cannot call action in the middle of an action$/);
		});
	});

	describe('Hoverboard.compose', function () {

		it('should take in static variables', function () {
			var store = Hoverboard.compose(123);

			expect(store()).to.equal(123);
		});

		it('should take in functions', function () {
			var store = Hoverboard.compose(function (setState) {
				setState(456);
			});

			expect(store()).to.equal(456);
		});

		it('should pass the state in to transforms when using functions', function () {
			var lastState;
			var store = Hoverboard.compose(function (setState) {
				setState({ a: 1 });
				setState({ b: 2 });
			}, function (state) {
				lastState = state;
				return state;
			});

			expect(lastState.b).to.equal(2);
			expect(lastState.a).to.be.undefined;
		});

		it('should take in a store', function () {
			var storeA = Hoverboard({
				init: function (state, newState) {
					return newState;
				}
			});

			var storeB = Hoverboard.compose(storeA);

			expect(storeB()).to.be.undefined;

			storeA.init(789);

			expect(storeB()).to.equal(789);
		});

		it('should take in an array of stores', function () {
			var storeA = Hoverboard({
				init: function (state, newState) {
					return newState;
				}
			});
			var storeB = Hoverboard({
				init: function (state, newState) {
					return newState;
				}
			});
			var mainStore = Hoverboard.compose([
				storeA, storeB
			]);

			storeA.init(123);
			storeB.init(456);

			expect(mainStore().join(',')).to.equal('123,456');
		});

		it('should take in an empty array', function () {
			var store = Hoverboard.compose([]);

			expect(store().length).to.equal(0);
			expect(store() instanceof Array).to.be.true;
		});

		it('should take in an array of static variables', function () {
			var store = Hoverboard.compose([ 123, 456 ]);

			expect(store().join(',')).to.equal('123,456');
		});

		it('should take in an object of stores', function () {
			var storeA = Hoverboard({
				init: function (state, newState) {
					return newState;
				}
			});
			var storeB = Hoverboard({
				init: function (state, newState) {
					return newState;
				}
			});
			var mainStore = Hoverboard.compose({
				a: storeA,
				b: storeB
			});

			storeA.init(123);
			storeB.init(456);

			expect(mainStore().a).to.equal(123);
			expect(mainStore().b).to.equal(456);
		});

		it('should take in an object of functions', function () {
			var store = Hoverboard.compose({
				a: function (setState) {
					setState(123);
				},
				b: function (setState) {
					setState(456);
				}
			});

			var state = store();

			expect(state.a).to.equal(123);
			expect(state.b).to.equal(456);
		});

		it('should be able to do all of this at once', function () {
			var storeA = Hoverboard({
				init: function (state, newState) {
					return newState;
				}
			});
			var storeB = Hoverboard({
				init: function (state, newState) {
					return newState;
				}
			});
			var mainStore = Hoverboard.compose({
				a: function (setState) {
					setState(123);
				},
				b: function (setState) {
					setState(456);
				},
				storeA: storeA,
				storeB: storeB,
				staticVar: 'hello',
				arr: Hoverboard.compose([
					storeA,
					storeB,
					function (setState) {
						setState('last')
					}
				]),
				staticArr: ['test']
			});

			storeA.init(789);
			storeB.init('abc');

			var state = mainStore();

			expect(state.a).to.equal(123);
			expect(state.b).to.equal(456);
			expect(state.storeA).to.equal(789);
			expect(state.storeB).to.equal('abc');
			expect(state.staticVar).to.equal('hello');
			expect(state.arr.join(',')).to.equal('789,abc,last');
			expect(state.staticArr.join(',')).to.equal('test');
		});

		it('should allow zero or more translate functions', function () {
			var storeA = Hoverboard({
				init: function (state, newState) {
					return newState;
				}
			});
			var storeB = Hoverboard.compose(storeA, function (state) {
				if (state) {
					state.a = 100;
				}
				return state;
			}, function (state) {
				if (state) {
					state.b += 50;
				}
				return state;
			});

			expect(storeB()).to.be.undefined;

			storeA.init({ b: 200 });

			expect(storeB().a).to.equal(100);
			expect(storeB().b).to.equal(250);
		});

		it('should resolve functions to undefined', function () {
			var setState;
			var store = Hoverboard.compose({
				fn: function (s) {
					setState = s;
				}
			});

			expect(store().fn).to.be.undefined;

			setState(1);

			expect(store().fn).to.equal(1);
		});

		it('should resolve functions to undefined in translate function too', function () {
			var store = Hoverboard.compose({
				fn: function () {},
				fn2: function (){}
			}, function (state) {
				expect('fn' in state).to.be.true;
				expect(state.fn).to.be.undefined;

				expect('fn2' in state).to.be.true;
				expect(state.fn2).to.be.undefined;
			});
		});

		it('should use the definition for arrays as the state container', function () {
			var fn = function (setState){ setState(1) },
				defArray = [fn],
				storeArray = Hoverboard.compose(defArray);

			expect(defArray[0]).to.equal(1);
		});

		it('should use the definition for plain objects as the state container', function () {
			var fn = function (setState){ setState(2) },
				defObject = { a: fn },
				storeObject = Hoverboard.compose(defObject);

			expect(defObject.a).to.equal(2);
		});

		it('should not leak state through translations', function () {
			var store = Hoverboard.compose({
				a: Hoverboard.compose(1)
			}, function () {
				return { b: 2 };
			});

			expect('a' in store()).to.be.false;
		});

		it('should pass-through actions on simple wrapper', function () {
			var store = Hoverboard({
				action: function(state, newState) { return newState }
			});

			var composed = Hoverboard.compose(store);

			composed.action(123);

			expect(composed()).to.equal(123);
		});

		it('should pass-through actions on translated store', function () {
			var store = Hoverboard({
				action: function(state, newState) { return newState }
			});

			var composed = Hoverboard.compose(store, function (state) {
				return state * 2
			});

			expect(composed.action(123)).to.equal(246);

			expect(composed).to.equal(composed.getState);
		});

		it('should pass-through stores in object structure', function () {
			var store = Hoverboard({
				action: function(state, newState) { return newState }
			});

			var composed = Hoverboard.compose({
				storeA: store,
				storeB: store,
				static: 5
			});

			expect(composed.storeA).to.equal(store);
			expect(composed.storeA.action).to.equal(store.action);
			expect(composed.storeB).to.equal(store);
			expect(composed.static).to.be.undefined;
		});

		it('should pass-through stores in array structure', function () {
			var store = Hoverboard({
				action: function(state, newState) { return newState }
			});

			var composed = Hoverboard.compose([
				store,
				store
			]);

			expect(composed[0]).to.equal(store)
			expect(composed[0].action).to.equal(store.action)
			expect(composed[1]).to.equal(store)
		});

		it('should pass-through stores in nested structure', function () {
			var store = Hoverboard({
				action: function(state, newState) { return newState }
			});

			var composed = Hoverboard.compose({
				things: Hoverboard.compose({
					store: store
				})
			});

			expect(composed.things.store).to.equal(store)
			expect(composed.things.store.action).to.equal(store.action)
		});
	});

}); // hoverboard

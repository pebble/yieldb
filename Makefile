
test:
	@NODE_ENV=test ./node_modules/.bin/mocha --harmony

test-cov:
	@NODE_ENV=test node_modules/.bin/istanbul cover \
		./node_modules/.bin/mocha \
		-- -u exports --harmony

open-cov:
	open coverage/lcov-report/index.html

test-travis:
	@NODE_ENV=test node_modules/.bin/istanbul cover \
		./node_modules/.bin/mocha \
		--report lcovonly \
		-- -u exports --harmony \
		--bail

.PHONY: test test-cov open-cov test-travis

/* Moralis init code */
const serverUrl = "https://nhmjipsooxi5.usemoralis.com:2053/server";
const appId = "pjmWEgZ4oGW7TpbKZ00N7rS2jz9zEqIlh1nvTjhz";
Moralis.start({ serverUrl, appId });

const TOKEN_CONTRACT_ADDRESS = "0x6093677d778Ac4B0037B4eb3048E6823a30D78fe";
const MARKETPLACE_CONTRACT_ADDRESS = "0xb1447aDc74879BC07C7b11B08Ab0482BD12CBD5D";
var user;

init = async () => {
	hideElement(userItemsSection);
	hideElement(userInfo);
	hideElement(createItemForm);
	window.web3 = await Moralis.enableWeb3();
	window.tokenContract = new web3.eth.Contract(tokenContractAbi, TOKEN_CONTRACT_ADDRESS);
	window.marketplaceContract = new web3.eth.Contract(marketplaceContractAbi, MARKETPLACE_CONTRACT_ADDRESS);
	initUser();
	loadItems();

	const soldItemsQuery = new Moralis.Query("ItemSold");
	const soldItemsSubscription = await soldItemsQuery.subscribe();
	soldItemsSubscription.on("create", onItemSold);

	const itemsAddedQuery = new Moralis.Query("ItemAdded");
	const itemsAddedSubscription = await itemsAddedQuery.subscribe();
	itemsAddedSubscription.on("create", onItemAdded);
};

onItemSold = async (item) => {
	const listing = document.getElementById(`items-${item.attributes.uid}`);
	if (listing) {
		listing.parentNode.removeChild(listing);
	}
	user = await Moralis.User.current();
	if (user) {
		const params = { uid: `${item.attributes.uid}` };
		const soldItem = await Moralis.Cloud.run("getItem", params);
		if (soldItem) {
			if (user.get("accounts").includes(item.attributes.buyer)) {
				getAndRenderItemData(soldItem, renderUserItem);
			}

			const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
			if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);
		}
	}
};

onItemAdded = async (item) => {
	const params = { uid: `${item.attributes.uid}` };
	const addedItem = await Moralis.Cloud.run("getItem", params);
	if (addedItem) {
		user = await Moralis.User.current();
		if (user) {
			if (user.get("accounts").includes(addedItem.ownerOf)) {
				const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
				if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);

				getAndRenderItemData(addedItem, renderUserItem);
				return;
			}
		}
		getAndRenderItemData(addedItem, renderItem);
	}
};

initUser = async () => {
	if (await Moralis.User.current()) {
		hideElement(userConnectButton);
		showElement(userProfileButton);
		showElement(openCreateItemButton);
		showElement(openUserItemsButton);
		loadUserItems();
	} else {
		showElement(userConnectButton);
		hideElement(userProfileButton);
		hideElement(openCreateItemButton);
		hideElement(openUserItemsButton);
	}
};

/* Authentication code */
async function login() {
	let user = Moralis.User.current();
	if (!user) {
		user = await Moralis.authenticate({ signingMessage: "Log in using Moralis" })
			.then(function (user) {
				console.log("logged in user:", user);
				console.log(user.get("ethAddress"));
			})
			.catch(function (error) {
				console(error);
			});
	}
	initUser();
}

async function logOut() {
	await Moralis.User.logOut();
	hideElement(userInfo);
	initUser();
	console.log("logged out");
}

openUserInfo = async () => {
	user = Moralis.User.current();
	if (user) {
		const email = user.get("email");
		if (email) {
			userEmailField.value = email;
		} else {
			userEmailField.value = "";
		}

		userUsernameField.value = user.get("username");

		const userAvatar = user.get("avatar");
		if (userAvatar) {
			userAvatarImg.src = userAvatar.url();
			showElement(userAvatarImg);
		} else {
			hideElement(userAvatarImg);
		}
		showElement(userInfo);
	} else {
		login();
	}
};

saveUserInfo = async () => {
	user.set("email", userEmailField.value);
	user.set("username", userUsernameField.value);

	if (userAvatarFile.files.length > 0) {
		const avatar = new Moralis.File("avatar.jpg", userAvatarFile.files[0]);
		user.set("avatar", avatar);
	}

	await user.save();
	alert("User Info saved successfully");
	openUserInfo();
};

createItem = async () => {
	if (createItemFile.files.length == 0) {
		alert("Please select a file");
		return;
	} else if (createItemNameField.value.length == 0) {
		alert("Please enter a name");
		return;
	}

	const nftFile = new Moralis.File("nftFile.jpg", createItemFile.files[0]);
	await nftFile.saveIPFS();

	const nftFilePath = nftFile.ipfs();
	// const nftFileHash = nftFile.hash();

	const metadata = {
		name: createItemNameField.value,
		description: createItemDescriptionField.value,
		image: nftFilePath,
	};

	const nftFileMetadataFile = new Moralis.File("metadata.json", { base64: btoa(JSON.stringify(metadata)) });
	await nftFileMetadataFile.saveIPFS();

	const nftFileMetadataFilePath = nftFileMetadataFile.ipfs();
	// const nftFileMetadataFileHash = nftFileMetadataFile.hash();

	const nftId = await mintNft(nftFileMetadataFilePath);

	// const Item = Moralis.Object.extend("Item");
	// // Create a new instance of the class
	// const item = new Item();
	// item.set("name", createItemNameField.value);
	// item.set("description", createItemDescriptionField.value);
	// item.set("nftFilePath", nftFilePath);
	// item.set("nftFileHash", nftFileHash);
	// item.set("nftFileMetadataFilePath", nftFileMetadataFilePath);
	// item.set("nftFileMetadataFileHash", nftFileMetadataFileHash);
	// item.set("nftId", nftId);
	// item.set("nftContractAddress", TOKEN_CONTRACT_ADDRESS);
	// await item.save();

	// console.log(item);

	user = await Moralis.User.current();

	const userAddress = user.get("ethAddress");

	switch (createItemStatusField.value) {
		case "0":
			return;
		case "1":
			await ensureMarketplaceIsApproved(nftId, TOKEN_CONTRACT_ADDRESS);
			await marketplaceContract.methods.addItemToMarket(nftId, TOKEN_CONTRACT_ADDRESS, createItemPriceField.value).send({ from: userAddress });
			break;
		case "2":
			alert("Not yet supported");
			return;
	}
};

mintNft = async (metadataUrl) => {
	const receipt = await tokenContract.methods.createItem(metadataUrl).send({ from: ethereum.selectedAddress });
	console.log(receipt);
	return receipt.events.Transfer.returnValues.tokenId;
};

openUserItems = async () => {
	user = await Moralis.User.current();
	if (user) {
		showElement(userItemsSection);
	} else {
		login();
	}
};

loadUserItems = async () => {
	const ownedItems = await Moralis.Cloud.run("getUserItems");
	ownedItems.forEach((item) => {
		const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
		if (userItemListing) return;
		getAndRenderItemData(item, renderUserItem);
	});
};

loadItems = async () => {
	const items = await Moralis.Cloud.run("getItems");
	user = await Moralis.User.current();
	items.forEach((item) => {
		if (user) {
			if (user.attributes.accounts.includes(item.ownerOf)) {
				const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
				if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);
				getAndRenderItemData(item, renderUserItem);
				return;
			}
		}
		getAndRenderItemData(item, renderItem);
	});
};

initTemplate = (id) => {
	const template = document.getElementById(id);
	template.id = "";
	template.parentNode.removeChild(template);
	return template;
};

renderUserItem = async (item) => {
	const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
	if (userItemListing) return;

	const userItem = userItemTemplate.cloneNode(true);
	userItem.getElementsByTagName("img")[0].alt = item.name;
	userItem.getElementsByTagName("img")[0].src = item.image;
	userItem.getElementsByTagName("h5")[0].innerText = item.name;
	userItem.getElementsByTagName("p")[0].innerText = item.description;

	userItem.getElementsByTagName("input")[0].value = item.askingPrice ?? 1;
	userItem.getElementsByTagName("input")[0].disabled = item.askingPrice > 0;
	userItem.getElementsByTagName("button")[0].disabled = item.askingPrice > 0;
	userItem.getElementsByTagName("button")[0].onclick = async () => {
		user = await Moralis.User.current();
		if (!user) {
			login();
			return;
		}
		await ensureMarketplaceIsApproved(item.tokenId, item.tokenAddress);
		await marketplaceContract.methods.addItemToMarket(item.tokenId, item.tokenAddress, userItem.getElementsByTagName("input")[0].value).send({ from: user.get("ethAddress") });
	};

	userItem.id = `user-item-${item.tokenObjectId}`;
	userItems.appendChild(userItem);
};

renderItem = (item) => {
	console.log(item);
	const itemForSale = marketplaceItemTemplate.cloneNode(true);
	if (item.avatar) {
		itemForSale.getElementsByTagName("img")[0].src = item.sellerAvatar.url();
		itemForSale.getElementsByTagName("img")[0].alt = item.sellerUsername;
	}
	itemForSale.getElementsByTagName("img")[1].alt = item.name;
	itemForSale.getElementsByTagName("img")[1].src = item.image;
	itemForSale.getElementsByTagName("h6")[0].innerText = item.name;
	itemForSale.getElementsByTagName("p")[0].innerText = item.description;

	itemForSale.getElementsByTagName("h5")[0].innerText = item.name;
	itemForSale.getElementsByTagName("button")[0].innerText = `Buy for ${item.askingPrice}`;
	itemForSale.getElementsByTagName("button")[0].onclick = () => buyItem(item);

	itemForSale.id = `item-${item.uid}`;
	itemsForSale.appendChild(itemForSale);
};

getAndRenderItemData = (item, renderFunction) => {
	fetch(item.tokenUri)
		.then((response) => response.json())
		.then((data) => {
			data.symbol = item.symbol;
			data.tokenId = item.tokenId;
			data.tokenAddress = item.tokenAddress;
			renderFunction(data);
		});
};

ensureMarketplaceIsApproved = async (tokenId, tokenAddress) => {
	user = await Moralis.User.current();
	const userAddress = user.get("ethAddress");
	const contract = new web3.eth.Contract(tokenContractAbi, tokenAddress);
	const approvedAddress = await contract.methods.getApproved(tokenId).call({ from: userAddress });
	if (approvedAddress !== MARKETPLACE_CONTRACT_ADDRESS) {
		await contract.methods.approve(MARKETPLACE_CONTRACT_ADDRESS, tokenId).send({ from: userAddress });
	}
};

buyItem = async (item) => {
	user = await Moralis.User.current();
	if (!user) {
		login();
		return;
	}
	await marketplaceContract.methods.buyItem(item.uid).send({ from: user.get("ethAddress"), value: item.askingPrice });
};

hideElement = (element) => (element.style.display = "none");
showElement = (element) => (element.style.display = "block");

// Navbar
const userConnectButton = document.getElementById("btnConnect");
userConnectButton.onclick = login;

const userProfileButton = document.getElementById("btnUserInfo");
userProfileButton.onclick = openUserInfo;

const openCreateItemButton = document.getElementById("btnOpenCreateItem");
openCreateItemButton.onclick = () => showElement(createItemForm);

// User Profile
const userInfo = document.getElementById("userInfo");
const userUsernameField = document.getElementById("txtUsername");
const userEmailField = document.getElementById("txtEmail");
const userAvatarImg = document.getElementById("imgAvatar");
const userAvatarFile = document.getElementById("fileAvatar");

document.getElementById("btn-logout").onclick = logOut;
document.getElementById("btnCloseUserInfo").onclick = () => hideElement(userInfo);
document.getElementById("saveUserInfo").onclick = saveUserInfo;

// Item Creation
const createItemForm = document.getElementById("createItem");

const createItemNameField = document.getElementById("txtCreateItemName");
const createItemDescriptionField = document.getElementById("txtCreateItemDescription");
const createItemPriceField = document.getElementById("numCreateItemPrice");
const createItemStatusField = document.getElementById("selectCreateItemStatus");
const createItemFile = document.getElementById("fileCreateItemFile");

document.getElementById("btnCloseCreateItem").onclick = () => hideElement(createItemForm);
document.getElementById("btnCreateItem").onclick = createItem;

// User Items
const userItemsSection = document.getElementById("userItems");
const userItems = document.getElementById("userItemsList");
document.getElementById("btnCloseUserItems").onclick = () => hideElement(userItemsSection);
const openUserItemsButton = document.getElementById("btnMyItems");
openUserItemsButton.onclick = openUserItems;

const userItemTemplate = initTemplate("itemTemplate");
const marketplaceItemTemplate = initTemplate("marketplaceItemTemplate");

// Items for sale
const itemsForSale = document.getElementById("itemsForSale");

init();

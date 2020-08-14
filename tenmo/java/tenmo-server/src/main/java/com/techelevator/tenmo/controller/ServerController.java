package com.techelevator.tenmo.controller;

import java.math.BigDecimal;
import java.security.Principal;

import javax.validation.Valid;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;

import com.techelevator.tenmo.dao.AccountDAO;
import com.techelevator.tenmo.dao.TransferDAO;
import com.techelevator.tenmo.dao.UserDAO;
import com.techelevator.tenmo.model.Account;
import com.techelevator.tenmo.model.AccountNotFoundException;
import com.techelevator.tenmo.model.TransferDetailsDTO;
import com.techelevator.tenmo.model.TransferNotFoundException;
import com.techelevator.tenmo.model.ForeignUserDTO;
import com.techelevator.tenmo.model.Transfer;
import com.techelevator.tenmo.model.TransferSimpleDetailsDTO;
import com.techelevator.tenmo.model.UserNotFoundException;

@RestController
//@PreAuthorize("isAuthenticated()")
public class ServerController {

	private AccountDAO accountDAO;
	private UserDAO userDAO;
	private TransferDAO transferDAO;

	public ServerController(AccountDAO accountDAO, UserDAO userDAO, TransferDAO transferDAO) {
		this.accountDAO = accountDAO;
		this.userDAO = userDAO;
		this.transferDAO = transferDAO;
	}

	// AccountRequests
	@RequestMapping(path = "/accounts/{user_id}/balance", method = RequestMethod.GET)
	public BigDecimal getAccountBlanceByUserId(@PathVariable Integer user_id) throws AccountNotFoundException {
		try {
			return accountDAO.getBalanceByUserId(user_id);
		} catch (ArrayIndexOutOfBoundsException e) {
			throw new AccountNotFoundException();
		}
	}

	@RequestMapping(path = "/accounts/{user_id}", method = RequestMethod.GET)
	public Account getAccountByUserId(@PathVariable Integer user_id) throws AccountNotFoundException {
		try {
			return accountDAO.findByUserId(user_id);
		} catch (ArrayIndexOutOfBoundsException e) {
			throw new AccountNotFoundException();
		}
	}

	// UserRequests
	@RequestMapping(path = "/users", method = RequestMethod.GET)
	public ForeignUserDTO[] getUserDTOs() {
		return userDAO.findForeignUsers();
	}

	@RequestMapping(path = "/users/{user_id}/transfers", method = RequestMethod.GET)
	public TransferSimpleDetailsDTO[] getTransfersContainingUserId(@PathVariable Integer user_id) throws UserNotFoundException{
		try {
			return transferDAO.findTransfersContainingUserId(user_id);
		} catch (ArrayIndexOutOfBoundsException e) {
			throw new UserNotFoundException();
		}
	}
	
	@RequestMapping(path = "/users/{user_id}/pending", method = RequestMethod.GET)
	public TransferSimpleDetailsDTO[] getPendingTransfersByUserId(@PathVariable Integer user_id) throws UserNotFoundException{
		try { 
			return transferDAO.findPendingTransfersByUserId(user_id);
		} catch (ArrayIndexOutOfBoundsException e) {
			throw new UserNotFoundException();
		}
	}
	
	// TransferRequests
	@RequestMapping(path = "/transfers", method = RequestMethod.POST)
	@ResponseStatus(HttpStatus.CREATED)
	public String transferProcessing(@Valid @RequestBody Transfer transfer) {
		switch (transfer.getTransfer_status_id()) {
		case 1:
			putTransferInDB(transfer);
			return "Pending Transaction Stored";
		case 2:
			return processTransfer(transfer);
		case 3:
			putTransferInDB(transfer);
			return "Transaction Rejected";
		default:
			return "Transaction Processing Error";
		}
	}

	@RequestMapping(path = "/transfers/{transfer_id}", method = RequestMethod.GET)
	public TransferDetailsDTO transferDetails(@PathVariable int transfer_id) throws TransferNotFoundException {
		try  {
			return transferDAO.transferDetails(transfer_id);
		} catch (ArrayIndexOutOfBoundsException e) {
			throw new TransferNotFoundException();
		}
	}
	
	@ResponseStatus(HttpStatus.ACCEPTED)
	@RequestMapping(path = "/transfers/{transfer_id}/{approval}", method = RequestMethod.PUT)
	public String transferDetails(@PathVariable int transfer_id, @PathVariable String approval) throws TransferNotFoundException{
		Transfer transfer = null;
		try {
			transfer = transferDAO.findTransferById(transfer_id);
		} catch (ArrayIndexOutOfBoundsException e) {
			throw new TransferNotFoundException();
		}
		if(approval.equals("approve")) {
			transfer.setTransfer_status_id(2);
		}
		if(approval.equals("reject")) {
			transfer.setTransfer_status_id(3);
		}
		return transferProcessing(transfer);
	}

	private String processTransfer(Transfer transfer) {
		BigDecimal transferFromBalance = getAccountBlanceByUserId(transfer.getAccount_from());
		if (transferFromBalance.compareTo(transfer.getAmount()) >= 0) {
			accountDAO.updateBalance(transfer.getAccount_from(), transfer.getAmount().negate());
			accountDAO.updateBalance(transfer.getAccount_to(), transfer.getAmount());
			putTransferInDB(transfer);
			return "Transaction Approved";
		} else {
			transfer.setTransfer_status_id(3);
			putTransferInDB(transfer);
			return "Transaction denied: Insufficent Funds";
		}
	}
	
	private void putTransferInDB(Transfer transfer) {
		if (transfer.getTransfer_id() == null) {
			transferDAO.insertTransfer(transfer);
		} else {
			transferDAO.updateTransfer(transfer);
		}
	}
}

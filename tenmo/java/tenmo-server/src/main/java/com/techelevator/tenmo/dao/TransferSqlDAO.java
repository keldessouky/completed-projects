package com.techelevator.tenmo.dao;

import java.util.ArrayList;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.rowset.SqlRowSet;
import org.springframework.stereotype.Component;

import com.techelevator.tenmo.model.TransferDetailsDTO;
import com.techelevator.tenmo.model.Transfer;
import com.techelevator.tenmo.model.TransferSimpleDetailsDTO;

@Component
public class TransferSqlDAO implements TransferDAO {

	private JdbcTemplate jdbcTemplate;

	public TransferSqlDAO(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Override
	public Transfer insertTransfer(Transfer transfer) {
		String SqlStringInsertTransfer = "INSERT INTO transfers (transfer_id, transfer_type_id, transfer_status_id, account_from, account_to, amount) "
				+ "VALUES (DEFAULT, ?, ?, ?, ?, ?) RETURNING transfer_id";
		Integer id = jdbcTemplate.queryForObject(SqlStringInsertTransfer, Integer.class, transfer.getTransfer_type_id(),
				transfer.getTransfer_status_id(), transfer.getAccount_from(), transfer.getAccount_to(),
				transfer.getAmount());

		return findTransferById(id);
	}

	@Override
	public Transfer findTransferById(int transferId) {
		String SqlStringFindTransferById = "SELECT * FROM transfers WHERE transfer_id = ?";
		SqlRowSet results = jdbcTemplate.queryForRowSet(SqlStringFindTransferById, transferId);
		results.next();
		Transfer transfer = mapRowToTransfer(results);

		return transfer;
	}

	@Override
	public TransferSimpleDetailsDTO[] findTransfersContainingUserId(int user_id) {
		List<TransferSimpleDetailsDTO> transferDTOs = new ArrayList<>();
		String SqlString = "SELECT transfers.transfer_id, transfers.account_from, transfers.account_to, "
				+ "transfers.amount, accounts.account_ID AS user_account_id " + "FROM transfers " + "JOIN accounts "
				+ "ON transfers.account_from = accounts.account_id OR transfers.account_to = accounts.account_id "
				+ "WHERE accounts.user_id = ? " + "ORDER By transfer_id ASC";
		SqlRowSet results = jdbcTemplate.queryForRowSet(SqlString, user_id);
		while (results.next()) {
			TransferSimpleDetailsDTO transferDTO = mapRowToTransferDTO(results, user_id);
			transferDTOs.add(transferDTO);
		}
		TransferSimpleDetailsDTO[] transferArray = transferDTOs.toArray(new TransferSimpleDetailsDTO[0]);
		return transferArray;
	}

	@Override
	public TransferSimpleDetailsDTO[] findPendingTransfersByUserId(int user_id) {
		List<TransferSimpleDetailsDTO> transferDTOs = new ArrayList<>();
		String SqlString = "SELECT transfers.transfer_id, transfers.account_from, transfers.account_to, transfers.amount, "
				+ "accounts.account_ID AS user_account_id " 
				+ "FROM transfers " 
				+ "JOIN accounts " 
				+ "ON transfers.account_from = accounts.account_id " 
				+ "WHERE transfers.transfer_status_id = 1 AND accounts.user_id = ? " 
				+ "ORDER By transfer_id ASC";
		SqlRowSet results = jdbcTemplate.queryForRowSet(SqlString, user_id);
		while (results.next()) {
			TransferSimpleDetailsDTO transferDTO = mapRowToTransferDTO(results, user_id);
			transferDTOs.add(transferDTO);
		}
		TransferSimpleDetailsDTO[] transferArray = transferDTOs.toArray(new TransferSimpleDetailsDTO[0]);
		return transferArray;
	}

	private TransferSimpleDetailsDTO mapRowToTransferDTO(SqlRowSet results, Integer user_id) {
		TransferSimpleDetailsDTO transferDTO = new TransferSimpleDetailsDTO();
		transferDTO.setTransfer_id(results.getInt("transfer_id"));
		if (results.getInt("account_from") == results.getInt("user_account_id")) {
			transferDTO.setTo();
			;
			transferDTO.setSecondParty(getUsernameByAccountId(results.getInt("account_to")));
		} else {
			transferDTO.setFrom();
			transferDTO.setSecondParty(getUsernameByAccountId(results.getInt("account_from")));
		}
		transferDTO.setAmount(results.getBigDecimal("amount"));
		return transferDTO;
	}

	private String getUsernameByAccountId(Integer account_id) {
		String SqlStringFindUsername = "SELECT username " + "FROM users " + "JOIN accounts "
				+ "ON accounts.user_id = users.user_id " + "WHERE account_id = ?";
		SqlRowSet result = jdbcTemplate.queryForRowSet(SqlStringFindUsername, account_id);
		result.next();
		return result.getString("username");

	}

	@Override
	public Transfer updateTransfer(Transfer transfer) {
		String SqlStringUpdateTransfer = "UPDATE transfers SET transfer_type_id = ?, transfer_status_id = ?, amount = ?, account_to = ?, account_from = ? WHERE transfer_id = ?";
		jdbcTemplate.update(SqlStringUpdateTransfer, transfer.getTransfer_type_id(), transfer.getTransfer_status_id(),
				transfer.getAmount(), transfer.getAccount_to(), transfer.getAccount_from(), transfer.getTransfer_id());

		return findTransferById(transfer.getTransfer_id());
	}

	public TransferDetailsDTO transferDetails(int transfer_id) {

		String SqlString = "SELECT transfers.transfer_id, transfers.account_from, transfers.account_to, transfer_types.transfer_type_desc, transfer_statuses.transfer_status_desc, transfers.amount"
				+ " FROM transfers \n" + "JOIN transfer_types "
				+ " ON transfers.transfer_type_id = transfer_types.transfer_type_id\n" + "JOIN transfer_statuses "
				+ " ON transfers.transfer_status_id = transfer_statuses.transfer_status_id"
				+ " WHERE transfers.transfer_id = ?";

		SqlRowSet results = jdbcTemplate.queryForRowSet(SqlString, transfer_id);
		results.next();
		TransferDetailsDTO details = mapRowToDetails(results);

		return details;
	}

	private TransferDetailsDTO mapRowToDetails(SqlRowSet results) {
		TransferDetailsDTO details = new TransferDetailsDTO();

		details.setId(results.getInt("transfer_id"));
		details.setFrom(getUsernameByAccountId(results.getInt("account_from")));
		details.setTo(getUsernameByAccountId(results.getInt("account_to")));
		details.setType(results.getString("transfer_type_desc"));
		details.setStatus(results.getString("transfer_status_desc"));
		details.setAmount(results.getBigDecimal("amount"));

		return details;
	}

	private Transfer mapRowToTransfer(SqlRowSet results) {
		Transfer transfer = new Transfer();
		transfer.setAccount_from(results.getInt("account_from"));
		transfer.setAccount_to(results.getInt("account_to"));
		transfer.setAmount(results.getBigDecimal("amount"));
		transfer.setTransfer_id(results.getInt("transfer_id"));
		transfer.setTransfer_type_id(results.getInt("transfer_type_id"));
		transfer.setTransfer_status_id(results.getInt("transfer_status_id"));
		return transfer;
	}

}

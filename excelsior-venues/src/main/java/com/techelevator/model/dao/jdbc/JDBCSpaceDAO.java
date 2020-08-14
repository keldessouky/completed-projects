package com.techelevator.model.dao.jdbc;

import java.util.ArrayList;
import java.util.List;

import javax.sql.DataSource;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.rowset.SqlRowSet;

import com.techelevator.model.dao.SpaceDAO;
import com.techelevator.model.domain.Space;

public class JDBCSpaceDAO implements SpaceDAO {

	private JdbcTemplate jdbcTemplate;

	public JDBCSpaceDAO(DataSource dataSource) {
		this.jdbcTemplate = new JdbcTemplate(dataSource);
	}

	@Override
	public List<Space> getSpacesFromVenue(String venueName) {
		List<Space> getSpace = new ArrayList<>();
		String sqlGetSpacesFromVenue = "SELECT space.id AS id, space.name AS name, space.open_from AS from, space.open_to AS to, "
				+ "CAST(space.daily_rate AS decimal (7,2)) AS rate, space.max_occupancy AS maxOcp\n" + "FROM space\n"
				+ "JOIN venue ON venue.id = space.venue_id\n" + "WHERE venue.name = ?";
		SqlRowSet results = jdbcTemplate.queryForRowSet(sqlGetSpacesFromVenue, venueName);
		while (results.next()) {
			Space space = mapRowToSpaceVenue(results);
			getSpace.add(space);
		}

		return getSpace;
	}

	private Space mapRowToSpaceVenue(SqlRowSet results) {
		Space space = new Space();
		space.setId(results.getLong("id"));
		space.setName(results.getString("name"));
		space.setOpenFrom(results.getInt("from"));
		space.setOpenTo(results.getInt("to"));
		space.setDailyRate(results.getDouble("rate"));
		space.setMaxOccupancy(results.getInt("maxOcp"));
		return space;
	}

	@Override
	public List<Space> getSpaceById(long spaceId) {
		List<Space> spaceById = new ArrayList<>();
		String sqlGetSpaceById = "SELECT space.name FROM space WHERE id = ?";
		SqlRowSet results = jdbcTemplate.queryForRowSet(sqlGetSpaceById, spaceId);
		while (results.next()) {
			Space space = mapRowToSpaceId(results);
			spaceById.add(space);
		}

		return spaceById;
	}

	private Space mapRowToSpaceId(SqlRowSet results) {
		Space space = new Space();
		space.setName(results.getString("name"));
		return space;
	}

	@Override
	public List<Space> getRateById(long spaceId) {
		List<Space> rateById = new ArrayList<>();
		String sqlGetRateById = "SELECT CAST(space.daily_rate AS decimal (7,2)) AS rate FROM space WHERE id = ?";
		SqlRowSet results = jdbcTemplate.queryForRowSet(sqlGetRateById, spaceId);
		while (results.next()) {
			Space space = mapRowToRateById(results);
			rateById.add(space);
		}

		return rateById;
	}

	private Space mapRowToRateById(SqlRowSet results) {
		Space space = new Space();
		space.setDailyRate(results.getDouble("rate"));
		return space;
	}

}

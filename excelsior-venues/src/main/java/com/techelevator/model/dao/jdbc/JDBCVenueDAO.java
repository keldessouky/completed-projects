package com.techelevator.model.dao.jdbc;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.rowset.SqlRowSet;

import com.techelevator.model.dao.VenueDAO;
import com.techelevator.model.domain.Venue;

public class JDBCVenueDAO implements VenueDAO {
	private JdbcTemplate jdbcTemplate;

	public JDBCVenueDAO(DataSource dataSource) {
		this.jdbcTemplate = new JdbcTemplate(dataSource);
	}

	@Override
	public List<Venue> getAllVenues() {
		// TODO Auto-generated method stub
		List<Venue> getAllVenues = new ArrayList<>();
		String sqlGetAllVenues = "SELECT venue.name AS venue, city.name AS city, city.state_abbreviation AS state, venue.description AS description \n"
				+ "FROM venue \n" + "JOIN city ON city.id = venue.city_id \n"
				+ "GROUP BY venue.name, city.name, city.state_abbreviation, venue.description\n"
				+ "ORDER BY venue.name;";
		SqlRowSet results = jdbcTemplate.queryForRowSet(sqlGetAllVenues);
		while (results.next()) {
			Venue venues = MapRowToVenueDetails(results);
			getAllVenues.add(venues);
		}
		return getAllVenues;
	}
	
	@Override
	public List<String> getCategories(Venue venueName) {
		List<String> venueCategories = new ArrayList<>();
		String sqlGetCategories = "SELECT category.name AS category_name FROM category "
				+ "JOIN category_venue ON category_venue.category_id = category.id "
				+ "JOIN venue ON category_venue.venue_id = venue.id " + "WHERE venue.name = ?";
		SqlRowSet results = jdbcTemplate.queryForRowSet(sqlGetCategories, venueName.getName());
		while (results.next()) {
			String venueCategory = results.getString("category_name");
			venueCategories.add(venueCategory);			
		}
		return venueCategories;
	}

	@Override
	public Map<Integer, Venue> venueMapper(List<Venue> venues) {
		Map<Integer, Venue> mapOfVenuesNewId = new HashMap<>();
		int id = 1;
		for (Venue venue : venues) {
			mapOfVenuesNewId.put(id, venue);
			id++;
		}
		return mapOfVenuesNewId;
	}
	
	private Venue MapRowToVenueDetails(SqlRowSet results) {
		Venue venues = new Venue();
		venues.setName(results.getString("venue"));
		venues.setCityName(results.getString("city"));
		venues.setStateAbbreviation(results.getString("state"));
		venues.setDescription(results.getString("description"));

		return venues;
	}

}
